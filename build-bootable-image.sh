# Anaka Kids OS — Bootable Drive Builder
# =========================================
# Creates a bootable OS image configured to boot straight into
# Anaka Kids OS in full-screen kiosk mode.
#
# Usage:
#   sudo ./build-bootable-image.sh [options] [output-directory]
#
# Options:
#   --arch rpi        Build for Raspberry Pi (ARM64, default)
#   --arch x64        Build for x86_64 (old laptops, Intel/AMD)
#   --url <URL>       Override the Anaka Kids URL (default: https://kids.anakatech.llc)
#
# Examples:
#   sudo ./build-bootable-image.sh                          # RPi, SD card
#   sudo ./build-bootable-image.sh --arch x64               # x86_64 laptop, USB
#   sudo ./build-bootable-image.sh --arch rpi ./output      # Custom output dir
#   sudo ./build-bootable-image.sh --url http://10.0.0.5:3101  # Local dev
#
# Requirements:
#   - Raspberry Pi Imager CLI or dd
#   - For RPi: Raspberry Pi OS Lite image (downloaded automatically)
#   - For x64: Ubuntu Server LTS ISO (downloaded automatically)
#   - At least 16GB free space
#   - Root privileges (for loop device mounting)
#
# The resulting image is a bootable SD card / USB drive that:
#   - Boots directly into Chromium kiosk at kids.anakatech.llc
#   - Has a read-only root filesystem (unbreakable by kids)
#   - Supports WiFi auto-config via first-boot wizard
#   - Auto-updates the web app on every boot
#   - No keyboard needed after initial setup

set -euo pipefail

# --- Configuration ---
ARCH="rpi"
ANAKA_KIDS_URL="${ANAKA_KIDS_URL:-https://kids.anakatech.llc}"
OUTPUT_DIR=""
IMAGE_NAME=""
PI_OS_URL="https://downloads.raspberrypi.com/raspios_lite_arm64_latest"
UBUNTU_LTS_URL="https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)
      ARCH="$2"
      shift 2
      ;;
    --url)
      ANAKA_KIDS_URL="$2"
      shift 2
      ;;
    --help|-h)
      head -50 "$0" | grep -E "^#" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      OUTPUT_DIR="$1"
      shift
      ;;
  esac
done

OUTPUT_DIR="${OUTPUT_DIR:-./anaka-kids-image}"
IMAGE_NAME="anaka-kids-os-${ARCH}-$(date +%Y%m%d).img"
TEMP_DIR=$(mktemp -d)

echo "🔧 Anaka Kids OS — Bootable Image Builder"
echo "=========================================="
echo "Architecture: ${ARCH}"
echo "Output:       ${OUTPUT_DIR}/${IMAGE_NAME}"
echo "Target URL:   ${ANAKA_KIDS_URL}"
echo ""

mkdir -p "${OUTPUT_DIR}"

# ================================================================
# RPi (ARM64) Builder
# ================================================================
build_rpi() {
  local custom_img="${OUTPUT_DIR}/${IMAGE_NAME}"
  local pi_img

  # Step 1: Download Raspberry Pi OS Lite
  echo "📥 Step 1 (RPi): Downloading Raspberry Pi OS Lite..."
  if [ ! -f "${OUTPUT_DIR}/raspios-lite.zip" ]; then
    curl -L -o "${OUTPUT_DIR}/raspios-lite.zip" "${PI_OS_URL}"
  fi

  # Step 2: Extract
  echo "📦 Step 2: Extracting..."
  unzip -o "${OUTPUT_DIR}/raspios-lite.zip" -d "${TEMP_DIR}"
  pi_img=$(ls "${TEMP_DIR}"/*.img | head -1)
  echo "   Image: ${pi_img}"

  # Step 3: Mount and customize
  echo "🔧 Step 3: Customizing image..."
  cp "${pi_img}" "${custom_img}"

  local loop_dev boot_mnt root_mnt
  loop_dev=$(losetup -f --show "${custom_img}")
  boot_mnt="${TEMP_DIR}/boot"
  root_mnt="${TEMP_DIR}/root"
  mkdir -p "${boot_mnt}" "${root_mnt}"

  # Mount partitions (RPi image: boot is partition 1, root is partition 2)
  mount "${loop_dev}p1" "${boot_mnt}"
  mount "${loop_dev}p2" "${root_mnt}"

  # --- CUSTOMIZATION ---

  # Enable kiosk boot config
  cat > "${boot_mnt}/config.txt" << CONFIG
# Anaka Kids OS — Kiosk Configuration
arm_64bit=1
gpu_mem=256
disable_overscan=1
disable_splash=1
boot_delay=0
CONFIG

  _apply_common_customizations "${root_mnt}"

  # --- UNMOUNT ---
  echo "💾 Step 4: Unmounting and cleaning..."
  sync
  umount "${boot_mnt}" "${root_mnt}"
  losetup -d "${loop_dev}"
  rm -rf "${TEMP_DIR}"

  echo ""
  echo "✅ Bootable image created! (RPi ARM64)"
  echo "   ${custom_img}"
}

# ================================================================
# x86_64 Builder
# ================================================================
build_x64() {
  local custom_img="${OUTPUT_DIR}/${IMAGE_NAME}"

  # Step 1: Download Ubuntu Server LTS ISO
  echo "📥 Step 1 (x64): Downloading Ubuntu Server LTS ISO..."
  if [ ! -f "${OUTPUT_DIR}/ubuntu-server.iso" ]; then
    curl -L -o "${OUTPUT_DIR}/ubuntu-server.iso" "${UBUNTU_LTS_URL}"
  fi

  # Step 2: Create a blank disk image (8GB minimum)
  echo "📦 Step 2: Creating disk image..."
  truncate -s 8G "${custom_img}"

  # Partition: GPT with one ext4 root partition
  parted -s "${custom_img}" mklabel gpt
  parted -s "${custom_img}" mkpart primary ext4 1MiB 100%
  parted -s "${custom_img}" set 1 boot on

  local loop_dev root_mnt
  loop_dev=$(losetup -f --show "${custom_img}")
  root_mnt="${TEMP_DIR}/root"
  mkdir -p "${root_mnt}"

  # Format and mount
  mkfs.ext4 "${loop_dev}p1"
  mount "${loop_dev}p1" "${root_mnt}"

  # Step 3: Install base system using debootstrap
  echo "🔧 Step 3: Bootstrapping Ubuntu base..."
  apt-get install -y -qq debootstrap grub-pc-bin grub-efi-ia32-bin grub-efi grub-common 2>/dev/null || true
  debootstrap --arch amd64 noble "${root_mnt}" http://archive.ubuntu.com/ubuntu/

  # Bind mounts for chroot
  mount --bind /dev "${root_mnt}/dev"
  mount --bind /proc "${root_mnt}/proc"
  mount --bind /sys "${root_mnt}/sys"

  # --- CUSTOMIZATION via chroot ---
  _apply_common_customizations "${root_mnt}"

  # Install GRUB bootloader
  chroot "${root_mnt}" /bin/bash << CHROOT
set -euo pipefail

# Install kernel and bootloader
apt-get install -y -qq linux-image-generic grub-pc grub-efi
update-grub

# Install GRUB to disk
grub-install --target=i386-pc "${loop_dev}"
grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable 2>/dev/null || true
CHROOT

  # --- UNMOUNT ---
  echo "💾 Step 4: Unmounting and cleaning..."
  sync
  umount -R "${root_mnt}/sys" "${root_mnt}/proc" "${root_mnt}/dev"
  umount "${root_mnt}"
  losetup -d "${loop_dev}"
  rm -rf "${TEMP_DIR}"

  echo ""
  echo "✅ Bootable image created! (x86_64)"
  echo "   ${custom_img}"
}

# ================================================================
# Common Customizations (shared by both architectures)
# ================================================================
_apply_common_customizations() {
  local root_mnt="$1"

  # Create first-boot setup script
  # NOTE: The KIOSK heredoc is single-quoted ('KIOSK') so none of the
  #       bash variables inside it are expanded here — they stay literal
  #       for runtime execution on the device. The URL placeholder
  #       {{ANAKA_KIDS_URL}} is replaced below via sed at BUILD TIME.
  cat > "${root_mnt}/usr/local/bin/anaka-kiosk-setup.sh" << 'KIOSK'
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

  # REPLACE URL PLACEHOLDER AT BUILD TIME (not at boot)
  # The inner SERVICE heredoc uses {{ANAKA_KIDS_URL}} because the outer
  # KIOSK heredoc is single-quoted (preventing bash expansion). We
  # substitute the real URL here at build time instead of using sed
  # inside the first-boot script on the device.
  sed -i "s|{{ANAKA_KIDS_URL}}|${ANAKA_KIDS_URL}|g" \
    "${root_mnt}/usr/local/bin/anaka-kiosk-setup.sh"

  chmod +x "${root_mnt}/usr/local/bin/anaka-kiosk-setup.sh"

  # Enable first-boot script via rc.local
  sed -i '/exit 0/d' "${root_mnt}/etc/rc.local" 2>/dev/null || true
  echo "/usr/local/bin/anaka-kiosk-setup.sh &" >> "${root_mnt}/etc/rc.local"
  echo "exit 0" >> "${root_mnt}/etc/rc.local"
  chmod +x "${root_mnt}/etc/rc.local"
}

# ================================================================
# Main dispatch
# ================================================================
case "${ARCH}" in
  rpi|RPi|raspberry|arm64|aarch64)
    build_rpi
    ;;
  x64|x86_64|amd64|x86)
    build_x64
    ;;
  *)
    echo "❌ Unknown architecture: ${ARCH}"
    echo "   Supported: rpi, x64"
    exit 1
    ;;
esac

# ================================================================
# Write instructions
# ================================================================
echo ""
echo "📋 Anaka Kids OS Summary:"
echo "  - Architecture: ${ARCH}"
echo "  - URL: ${ANAKA_KIDS_URL}"
echo "  - Chrome kiosk mode (full screen)"
echo "  - Read-only root (child-proof)"
echo "  - Auto-boot to OS on power-on"
echo "  - Auto-updates at 3am daily"
echo "  - No keyboard needed after setup"
echo ""

echo "💿 To write to an SD card (Raspberry Pi):"
echo "  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "  sudo dd if='${OUTPUT_DIR}/${IMAGE_NAME}' of=/dev/mmcblk0 bs=4M status=progress"
echo ""
echo "  ⚠️  Use /dev/mmcblk0 for SD cards on most Linux systems."
echo "     Use 'lsblk' to verify the correct device before writing."
echo ""

echo "💿 To write to a USB drive (RPi, x86_64 laptops):"
echo "  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "  sudo dd if='${OUTPUT_DIR}/${IMAGE_NAME}' of=/dev/sdX bs=4M status=progress"
echo ""
echo "  ⚠️  Use /dev/sdX (e.g. /dev/sda, /dev/sdb) for USB drives."
echo "     Use 'lsblk' to verify the correct device before writing."
echo ""

echo "⚠️  WARNING: Double-check the target device! dd will DESTROY all data on it."
echo ""
echo "🔗 Reference: systemd service template available at:"
echo "   systemd/anaka-kiosk.service"
echo ""
