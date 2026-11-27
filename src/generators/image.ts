import sharp from 'sharp';
import type { Channel, Offer } from '../types/index.js';
import { displayTitle } from '../utils/title.js';

const colors = {
  background: '#0B0E13',
  green: '#39FF88',
  white: '#F5F5F5',
  yellow: '#FFCC00',
  panel: '#101A19',
  muted: '#A7B9AE',
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function titleLines(title: string): {
  lines: string[];
  size: number;
  step: number;
} {
  const size = title.length <= 42 ? 60 : title.length <= 78 ? 48 : 38;
  const max = Math.floor(725 / (size * 0.64));
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    if (word.length > max) {
      if (lines.length && lines[lines.length - 1]) lines.push('');
      for (let i = 0; i < word.length; i += max)
        lines.push(word.slice(i, i + max));
    } else if (
      !lines.length ||
      (lines[lines.length - 1]?.length ?? 0) + word.length + 1 > max
    ) {
      lines.push(word);
    } else {
      lines[lines.length - 1] += ` ${word}`;
    }
  }
  const shown = lines.slice(0, 3);
  if (lines.length > 3 && shown[2]) shown[2] = `${shown[2].slice(0, -1)}…`;
  return { lines: shown, size, step: size + 13 };
}

function terminalArtwork(variant: number): string {
  const mark =
    variant === 0
      ? `<path d="M961 354h88v83h-88z M1005 354v83 M961 379h88 M973 342c-17-27 20-39 32 0 M1037 342c17-27-20-39-32 0" fill="none" stroke="${colors.yellow}" stroke-width="9" stroke-linejoin="round" stroke-linecap="square"/>`
      : `<path d="M936 409l19-53q8-23 31-22h38q13 13 27 0h32q22 0 29 22l17 53q5 28-23 27l-39-25h-64l-39 25q-28 1-28-27z" fill="none" stroke="${colors.yellow}" stroke-width="9" stroke-linejoin="round"/><path d="M974 365v40 M954 385h40" stroke="${colors.yellow}" stroke-width="8"/><circle cx="1084" cy="370" r="7" fill="${colors.yellow}"/><circle cx="1105" cy="390" r="7" fill="${colors.yellow}"/>`;
  return `<g>
    <rect x="858" y="209" width="284" height="281" rx="18" fill="#06140F" stroke="${colors.green}" stroke-width="5"/>
    <path d="M860 256h280" stroke="${colors.green}" stroke-width="5"/>
    <rect x="878" y="226" width="12" height="12" fill="${colors.yellow}"/>
    <rect x="900" y="226" width="12" height="12" fill="${colors.green}"/>
    <rect x="922" y="226" width="12" height="12" fill="${colors.green}"/>
    <path d="M887 292h45 M887 309h31 M1085 292h25 M1085 309h14" stroke="${colors.green}" stroke-width="3" opacity=".55"/>
    ${mark}
    <path d="M883 455h54 M1066 455h49" stroke="${colors.green}" stroke-width="4"/>
    <text x="878" y="521" font-size="19" fill="${colors.green}">[ ДОСТУПНО СЕЙЧАС ]</text>
  </g>`;
}

export async function generateImage(
  offer: Offer,
  channel: Channel,
): Promise<Buffer> {
  const variant = (Number(offer.id.replace(/\D/g, '').slice(-5)) || 0) % 2;
  const title = titleLines(displayTitle(offer.title));
  const titleSvg = title.lines
    .map(
      (line, index) =>
        `<text x="85" y="${291 + index * title.step}" font-size="${title.size}" font-weight="800" fill="${colors.white}">${escapeXml(line)}</text>`,
    )
    .join('');
  const date = offer.endsAt
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'UTC',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(offer.endsAt))
    : undefined;
  const platform = offer.platforms.join(' · ').slice(0, 28);
  const brand = escapeXml(channel.name);
  const previousPrice = offer.originalPrice
    ? `<text x="88" y="624" font-size="19" fill="${colors.muted}">БЫЛО: ${escapeXml(offer.originalPrice)}</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" font-family="DejaVu Sans Mono, Consolas, monospace">
    <defs>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#14261C" stroke-width="1"/></pattern>
      <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4" stroke="#39FF88" stroke-opacity=".035"/></pattern>
      <filter id="glow"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <rect width="1200" height="675" fill="${colors.background}"/>
    <rect width="1200" height="675" fill="url(#grid)" opacity=".45"/>
    <rect x="27" y="23" width="1146" height="629" rx="24" fill="none" stroke="${colors.green}" stroke-width="8" opacity=".20" filter="url(#glow)"/>
    <rect x="30" y="26" width="1140" height="623" rx="22" fill="none" stroke="${colors.green}" stroke-width="3"/>
    <rect x="49" y="47" width="91" height="78" rx="9" fill="#152520" stroke="${colors.green}" stroke-width="3"/>
    <rect x="58" y="56" width="73" height="57" rx="3" fill="#06150E" stroke="${colors.green}" stroke-width="2"/>
    <path d="M69 72l13 10-13 10 M88 95h24" fill="none" stroke="${colors.green}" stroke-width="4" stroke-linecap="square"/>
    <text x="161" y="91" font-size="45" font-weight="900" fill="${colors.white}">${brand}</text>
    <text x="163" y="119" font-size="19" letter-spacing="1" fill="${colors.green}">ЗАПУСТИ ХАЛЯВУ</text>
    <text x="907" y="86" font-size="19" fill="${colors.green}">@halyava_exe_hub</text>
    <path d="M53 150h1094" stroke="${colors.green}" stroke-width="2" opacity=".8"/>
    <path d="M52 168h19 M81 168h19 M110 168h19 M139 168h19" stroke="${colors.yellow}" stroke-width="5"/>
    <g font-family="DejaVu Sans Mono, Consolas, monospace">
      <text x="79" y="220" font-size="24" font-weight="700" fill="${colors.green}">&gt;_ НАЙДЕНА РАЗДАЧА</text>
      ${titleSvg}
      <rect x="79" y="469" width="445" height="80" rx="8" fill="${colors.yellow}"/>
      <path d="M79 469h445v80H79z" fill="none" stroke="#FFE169" stroke-width="3"/>
      <text x="102" y="522" font-size="43" font-weight="900" fill="${colors.background}">БЕСПЛАТНО</text>
      <text x="545" y="518" font-size="27" fill="${colors.green}">&gt; ЗАБРАТЬ</text>
      ${terminalArtwork(variant)}
      <path d="M55 566h1090" stroke="${colors.green}" stroke-width="2" opacity=".7"/>
      <text x="82" y="600" font-size="16" fill="${colors.muted}">ПЛАТФОРМА</text>
      <text x="82" y="629" font-size="24" font-weight="700" fill="${colors.white}">${escapeXml(platform)}</text>
      <text x="818" y="600" font-size="16" fill="${colors.muted}">${date ? 'ЗАБРАТЬ ДО' : 'СРОК АКЦИИ'}</text>
      <text x="818" y="629" font-size="24" font-weight="700" fill="${colors.green}">${date ? escapeXml(date) : 'НЕ УКАЗАН'}</text>
      ${previousPrice}
    </g>
    <rect width="1200" height="675" fill="url(#scan)" pointer-events="none"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
