document.querySelector('.scroll-arrow').addEventListener('click', () => {
  document.getElementById('slide-2').scrollIntoView({ behavior: 'smooth' });
});

function chooseClimate() {
  document.getElementById('reveal-overlay').classList.add('visible');
  document.querySelector('.hot-cold-halves').style.opacity = '0';
  document.querySelector('.hot-cold-halves').style.pointerEvents = 'none';
}