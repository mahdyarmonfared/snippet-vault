/**
 * Zero-dependency cross-platform clipboard copy helper.
 * Supports Linux (wl-copy, xclip, xsel), macOS (pbcopy), Windows (clip, powershell).
 */

const { spawnSync } = require('child_process');

function copyToClipboard(text) {
  if (typeof text !== 'string') return { success: false, error: 'Text must be a string' };

  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      const proc = spawnSync('pbcopy', [], { input: text, encoding: 'utf8' });
      if (proc.status === 0) return { success: true, method: 'pbcopy' };
    }

    if (platform === 'win32') {
      const proc = spawnSync('clip', [], { input: text, encoding: 'utf8' });
      if (proc.status === 0) return { success: true, method: 'clip' };
    }

    if (platform === 'linux' || platform === 'freebsd') {
      // 1. Try Wayland wl-copy
      let proc = spawnSync('wl-copy', [], { input: text, encoding: 'utf8' });
      if (proc.status === 0) return { success: true, method: 'wl-copy' };

      // 2. Try xclip
      proc = spawnSync('xclip', ['-selection', 'clipboard'], { input: text, encoding: 'utf8' });
      if (proc.status === 0) return { success: true, method: 'xclip' };

      // 3. Try xsel
      proc = spawnSync('xsel', ['--clipboard', '--input'], { input: text, encoding: 'utf8' });
      if (proc.status === 0) return { success: true, method: 'xsel' };
    }
  } catch (err) {
    // Clipboard spawn error
  }

  return {
    success: false,
    fallback: true,
    message: 'Clipboard command unavailable on system. Displaying raw output below.'
  };
}

module.exports = {
  copyToClipboard
};
