const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationCenter.tsx', 'utf8');

// First, revert the wrong replacements
content = content.replace(/text-\[#041e49\] dark:text-blue-200merald-500/g, 'text-emerald-500');
content = content.replace(/text-\[#001d35\] dark:text-blue-100merald-500/g, 'text-emerald-500'); // Just in case
content = content.replace(/text-\[#041e49\] dark:text-blue-200/g, 'text-[#041e49]');
content = content.replace(/text-\[#001d35\] dark:text-blue-100/g, 'text-[#001d35]');
content = content.replace(/bg-\[#f6f8fc\] dark:bg-slate-900/g, 'bg-[#f6f8fc]');
content = content.replace(/bg-\[#c2e7ff\] dark:bg-blue-900\/50/g, 'bg-[#c2e7ff]');
content = content.replace(/hover:bg-\[#b3d7ef\] dark:hover:bg-blue-800\/50/g, 'hover:bg-[#b3d7ef]');
content = content.replace(/bg-\[#d3e3fd\] dark:bg-blue-900\/30/g, 'bg-[#d3e3fd]');
content = content.replace(/bg-\[#f1f3f4\] dark:bg-slate-700/g, 'bg-[#f1f3f4]');

// Also revert the other dark mode classes to start fresh
content = content.replace(/ dark:border-slate-700/g, '');
content = content.replace(/ dark:bg-slate-800\/50/g, '');
content = content.replace(/ dark:bg-slate-800\/80/g, '');
content = content.replace(/ dark:bg-slate-800/g, '');
content = content.replace(/ dark:text-white/g, '');
content = content.replace(/ dark:text-slate-300/g, '');
content = content.replace(/ dark:hover:bg-slate-700/g, '');
content = content.replace(/ dark:bg-blue-900\/50/g, '');
content = content.replace(/ dark:text-blue-400/g, '');
content = content.replace(/ dark:text-slate-400/g, '');
content = content.replace(/ dark:text-slate-500/g, '');
content = content.replace(/ dark:text-slate-200/g, '');
content = content.replace(/ dark:bg-slate-700/g, '');
content = content.replace(/ dark:focus:bg-slate-800/g, '');
content = content.replace(/ dark:border-slate-600/g, '');
content = content.replace(/ dark:text-slate-600/g, '');
content = content.replace(/ dark:hover:bg-slate-600/g, '');

// Now apply the correct replacements
const replacements = {
  'bg-\\[#f6f8fc\\]': 'bg-[#f6f8fc] dark:bg-slate-900',
  'border-slate-200': 'border-slate-200 dark:border-slate-700',
  'bg-white': 'bg-white dark:bg-slate-800',
  'text-slate-800': 'text-slate-800 dark:text-white',
  'bg-\\[#c2e7ff\\]': 'bg-[#c2e7ff] dark:bg-blue-900/50',
  'hover:bg-\\[#b3d7ef\\]': 'hover:bg-[#b3d7ef] dark:hover:bg-blue-800/50',
  'text-\\[#001d35\\]': 'text-[#001d35] dark:text-blue-100',
  'bg-\\[#d3e3fd\\]': 'bg-[#d3e3fd] dark:bg-blue-900/30',
  'text-\\[#041e49\\]': 'text-[#041e49] dark:text-blue-200',
  'text-slate-600': 'text-slate-600 dark:text-slate-300',
  'hover:bg-slate-100': 'hover:bg-slate-100 dark:hover:bg-slate-700',
  'border-slate-100': 'border-slate-100 dark:border-slate-700',
  'text-slate-900': 'text-slate-900 dark:text-white',
  'bg-blue-100': 'bg-blue-100 dark:bg-blue-900/50',
  'text-blue-600': 'text-blue-600 dark:text-blue-400',
  'text-slate-500': 'text-slate-500 dark:text-slate-400',
  'text-slate-400': 'text-slate-400 dark:text-slate-500',
  'text-slate-700': 'text-slate-700 dark:text-slate-200',
  'bg-\\[#f1f3f4\\]': 'bg-[#f1f3f4] dark:bg-slate-700',
  'focus:bg-white': 'focus:bg-white dark:focus:bg-slate-800',
  'border-slate-300': 'border-slate-300 dark:border-slate-600',
  'bg-slate-50': 'bg-slate-50 dark:bg-slate-800/50',
  'text-slate-200': 'text-slate-200 dark:text-slate-600',
  'hover:bg-slate-200': 'hover:bg-slate-200 dark:hover:bg-slate-600',
  'text-slate-300': 'text-slate-300 dark:text-slate-500'
};

for (const [key, value] of Object.entries(replacements)) {
  content = content.replace(new RegExp('(?<![\\\\w:-])' + key + '(?![\\\\w:-])', 'g'), value);
}

fs.writeFileSync('src/components/NotificationCenter.tsx', content);
