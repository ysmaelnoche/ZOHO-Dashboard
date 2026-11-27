export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing dashboard element ' + id);
  return node as T;
}

export const escape = (value: string | number) => String(value).replace(/[&<>"']/g, character => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character
));
const clock = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
export const when = (value: number | null) => value === null ? 'No deadline recorded' : clock.format(value) + ' PHT';

export function table(label: string, columns: string[], rows: string[][]) {
  return '<div class="table-scroll" tabindex="0" role="region" aria-label="' + escape(label) + '"><table><thead><tr>' +
    columns.map(column => '<th scope="col">' + escape(column) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr><th scope="row">' + escape(row[0]) + '</th>' +
      row.slice(1).map(value => '<td>' + escape(value) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}
