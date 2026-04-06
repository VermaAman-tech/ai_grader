document.addEventListener('DOMContentLoaded', () => {
  // Auto-dismiss alerts
  document.querySelectorAll('.alert').forEach(el => {
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 5000);
  });

  // Init Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
});
