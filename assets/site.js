// Minimal site script: keep content visible when JS runs but avoid other interactive behaviour
// This replaces the previous site.js temporarily to ensure legal pages (and any
// other content hidden by [data-reveal]) are visible even if the full JS bundle
// was causing errors.

document.addEventListener('DOMContentLoaded', function () {
  try {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('in');
    });
  } catch (e) {
    // swallow errors to avoid breaking page rendering
    console.error('reveal-or-unhide error', e);
  }
});
