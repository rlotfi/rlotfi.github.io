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