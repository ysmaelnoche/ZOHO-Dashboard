(function() {
  'use strict';
  const form = document.getElementById('compare-form');
  const choices = ['left-choice', 'right-choice'].map(id => document.getElementById(id));
  const panes = document.getElementById('compare-panes');
  const status = document.getElementById('compare-status');

  form.addEventListener('submit', event => {
    event.preventDefault();
    const selected = choices.map(choice => choice.selectedOptions[0]);
    if (selected[0].value === selected[1].value) {
      status.textContent = 'Choose two different concepts.';
      choices[1].focus();
      return;
    }
    panes.replaceChildren(...selected.map(option => {
      const panel = document.createElement('div');
      const link = document.createElement('a');
      link.href = './' + option.value;
      link.textContent = 'Open full preview: ' + option.textContent;
      const frame = document.createElement('iframe');
      frame.title = option.textContent + ' interactive preview';
      frame.src = link.href;
      panel.append(link, frame);
      return panel;
    }));
    panes.hidden = false;
    status.textContent = `Showing ${selected[0].textContent} and ${selected[1].textContent}.`;
  });
})();
