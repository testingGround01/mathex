const PARTIALS = ['header.html', 'dashboard.html', 'practice.html', 'study.html', 'review.html', 'footer.html'];

async function loadPartials() {
  const container = document.getElementById('app');
  for (const file of PARTIALS) {
    const res = await fetch(`partials/${file}`);
    const html = await res.text();
    container.insertAdjacentHTML('beforeend', html);
  }

  const script = document.createElement('script');
  script.src = 'script.js';
  script.onload = () => {
    if (typeof initMathex === 'function') initMathex();
  };
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', loadPartials);
