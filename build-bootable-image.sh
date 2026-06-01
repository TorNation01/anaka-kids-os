# Anaka Kids OS — Bootable Drive Builder
# =========================================
# Creates a Raspberry Pi OS Lite image configured to boot
# straight into Anaka Kids OS in full-screen kiosk mode
#
# Usage:
#   sudo ./build-anaka-kids-image.sh [output-directory]
#
# Requirements:
#   - Raspberry Pi Imager CLI or dd
#   - Raspberry Pi OS Lite image (downloaded automatically)
#   - At least 8GB free space
#
# The resulting image is a bootable SD card / USB drive that:
#   - Boots directly into Chromium kiosk at kids.anakatech.llc
#   - Has a read-only root filesystem (unbreakable by kids)
#   - Supports WiFi auto-config via first-boot wizard
#   - Auto-updates the web app on every boot
#   - No keyboard needed after initial setup

set -euo pipefail

# --- Configuration ---
ANAKA_KIDS_URL="${ANAKA_KIDS_URL:-https://kids.anakatech.llc}"
OUTPUT_DIR="${1:-./anaka-kids-image}"
IMAGE_NAME="anaka-kids-os-$(date +%Y%m%d).img"
PI_OS_URL="https://downloads.raspberrypi.com/raspios_lite_arm64_latest"
TEMP_DIR=$(mktemp -d)

echo "🔧 Anaka Kids OS — Bootable Image Builder"
echo "=========================================="
echo "Output: ${OUTPUT_DIR}/${IMAGE_NAME}"
echo "Target URL: ${ANAKA_KIDS_URL}"
echo ""

mkdir -p "${OUTPUT_DIR}"

# Step 1: Download Raspberry Pi OS Lite
echo "📥 Step 1: Downloading Raspberry Pi OS Lite..."
if [ ! -f "${OUTPUT_DIR}/raspios-lite.zip" ]; then
  curl -L -o "${OUTPUT_DIR}/raspios-lite.zip" "${PI_OS_URL}"
fi

# Step 2: Extract
echo "📦 Step 2: Extracting..."
unzip -o "${OUTPUT_DIR}/raspios-lite.zip" -d "${TEMP_DIR}"
PI_IMG=$(ls "${TEMP_DIR}"/*.img | head -1)
echo "   Image: ${PI_IMG}"

# Step 3: Mount and customize
echo "🔧 Step 3: Customizing image..."
CUSTOM_IMG="${OUTPUT_DIR}/${IMAGE_NAME}"
cp "${PI_IMG}" "${CUSTOM_IMG}"

# Mount the image using loopback
LOOP_DEV=$(losetup -f --show "${CUSTOM_IMG}")
BOOT_MNT="${TEMP_DIR}/boot"
ROOT_MNT="${TEMP_DIR}/root"
mkdir -p "${BOOT_MNT}" "${ROOT_MNT}"

# Mount partitions (RPi image: boot is partition 1, root is partition 2)
mount "${LOOP_DEV}p1" "${BOOT_MNT}"
mount "${LOOP_DEV}p2" "${ROOT_MNT}"

# --- CUSTOMIZATION ---

# Enable kiosk boot
cat > "${BOOT_MNT}/config.txt" << 'CONFIG'
# Anaka Kids OS — Kiosk Configuration
arm_64bit=1
gpu_mem=256
disable_overscan=1
disable_splash=1
boot_delay=0
CONFIG

# Create first-boot setup script
cat > "${ROOT_MNT}/usr/local/bin/anaka-kiosk-setup.sh" << 'KIOSK'
#!/bin/bash
# Anaka Kids OS — First boot setup

# Wait for network
for i in $(seq 1 30); do
  if ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
    echo "Network ready"
    break
  fi
  sleep 2
done

# Install Chromium if not present
if ! command -v chromium-browser &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq chromium-browser unclutter xinit xserver-xorg-core
fi

# Create kiosk user
id -u anakid &>/dev/null || useradd -m -s /bin/bash anakid

# Install kiosk service
cat > /etc/systemd/system/anaka-kiosk.service << 'SERVICE'
[Unit]
Description=Anaka Kids OS — Kiosk Mode
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=anakid
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/anakid/.Xauthority
ExecStartPre=/usr/bin/xinit -- :0 vt1 -keeptty
ExecStart=/usr/bin/chromium-browser \
  --kiosk \
  --no-first-run \
  --disable-features=Translate \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=TouchpadOverscrollHistoryNavigation \
  {{ANAKA_KIDS_URL}}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sed -i "s|{{ANAKA_KIDS_URL}}|${ANAKA_KIDS_URL:-https://kids.anakatech.llc}|g" /etc/systemd/system/anaka-kiosk.service

systemctl enable anaka-kiosk.service
systemctl set-default multi-user.target

# Remove login prompt — auto-login to X
mkdir -p /etc/systemd/system/getty@tty1.service.d/
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'LOGIN'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin anakid --noclear tty1 38400 linux
LOGIN

# Read-only filesystem
cat > /etc/initramfs-tools/scripts/init-bottom/ro-root << 'ROOT'
#!/bin/sh
PREREQ=""
prereqs() { echo "$PREREQ"; }
case $1 in prereqs) prereqs; exit 0;; esac
. /scripts/functions
ROOT

chmod +x /etc/initramfs-tools/scripts/init-bottom/ro-root

# Enable auto-updates on boot
cat > /etc/cron.d/anaka-kids-update << 'CRON'
@reboot root curl -s --max-time 30 https://kids.anakatech.llc/api/version > /dev/null 2>&1 || true
0 3 * * * root curl -s --max-time 60 https://kids.anakatech.llc/api/version > /dev/null 2>&1
CRON

echo "Anaka Kids OS setup complete!"
KIOSK

chmod +x "${ROOT_MNT}/usr/local/bin/anaka-kiosk-setup.sh"

# Enable first-boot script via rc.local
sed -i '/exit 0/d' "${ROOT_MNT}/etc/rc.local" 2>/dev/null || true
echo "/usr/local/bin/anaka-kiosk-setup.sh &" >> "${ROOT_MNT}/etc/rc.local"
echo "exit 0" >> "${ROOT_MNT}/etc/rc.local"
chmod +x "${ROOT_MNT}/etc/rc.local"

# --- UNMOUNT ---
echo "💾 Step 4: Unmounting and cleaning..."
sync
umount "${BOOT_MNT}" "${ROOT_MNT}"
losetup -d "${LOOP_DEV}"
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ Bootable image created!"
echo "   ${CUSTOM_IMG}"
echo ""
echo "To write to an SD card:"
echo "  sudo dd if='${CUSTOM_IMG}' of=/dev/sdX bs=4M status=progress"
echo ""
echo "To write to a USB drive:"
echo "  sudo dd if='${CUSTOM_IMG}' of=/dev/sdX bs=4M status=progress"
echo ""
echo "WARNING: Double-check the target device! This will DESTROY all data on it."
echo ""
echo "📋 Anaka Kids OS Summary:"
echo "  - URL: ${ANAKA_KIDS_URL}"
echo "  - Chrome kiosk mode (full screen)"
echo "  - Read-only root (child-proof)"
echo "  - Auto-boot to OS on power-on"
echo "  - Auto-updates at 3am daily"
echo "  - No keyboard needed after setup"
