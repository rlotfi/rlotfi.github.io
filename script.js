// Intersection Observer for typewriter animation
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            // Only trigger animation once
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1 // Trigger when at least 10% of the element is visible
});

// Observe all h1 elements
document.addEventListener('DOMContentLoaded', () => {
    const h1Elements = document.querySelectorAll('h1');
    h1Elements.forEach(h1 => observer.observe(h1));
});

function showPopup() {
  const popup = document.getElementById('popup');
  popup.classList.add('show');
  
  // Remove the popup after 5 seconds
  setTimeout(() => {
    popup.classList.remove('show');
  }, 5000);
}

// Add this to your form submission handler
form.addEventListener('submit', (e) => {
  e.preventDefault();
  // ... your existing form handling code ...
  
  showPopup();
}); 