const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});

export const manilaDay = (time: number) => {
  const parts = Object.fromEntries(dayFormat.formatToParts(time).map(part => [part.type, part.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
};
