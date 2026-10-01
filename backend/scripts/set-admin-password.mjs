import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  console.error('请在交互式终端运行 npm run setup:admin。');
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
function hiddenPrompt(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { process.stdin.setRawMode(false); rl.close(); process.exit(130); }
        if (char === '\r' || char === '\n') {
          process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); resolve(value); return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}
const password = await hiddenPrompt('设置管理员密码（至少 12 位，不会显示在屏幕上）：');
if (password.length < 12) { console.error('密码至少需要 12 位。'); rl.close(); process.exit(1); }
const confirmation = await hiddenPrompt('再次输入管理员密码：');
if (password !== confirmation) { console.error('两次输入不一致。'); rl.close(); process.exit(1); }
const hash = await bcrypt.hash(password, 12);
const envPath = path.resolve(process.cwd(), '.env');
let content = '';
try { content = await readFile(envPath, 'utf8'); } catch {}
function set(key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  content = pattern.test(content) ? content.replace(pattern, line) : `${content}${content && !content.endsWith('\n') ? '\n' : ''}${line}\n`;
}
set('ADMIN_PASSWORD_HASH', hash);
set('ADMIN_JWT_SECRET', randomBytes(48).toString('base64url'));
await writeFile(envPath, content, { mode: 0o600 });
console.log('管理员密码哈希和会话密钥已安全写入 backend/.env。');
rl.close();
