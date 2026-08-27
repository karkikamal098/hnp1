// Minimal site script: keep content visible when JS runs but avoid other interactive behaviour
// This replaces the previous site.js temporarily to ensure legal pages (and any
// other content hidden by [data-reveal]) are visible even if the full JS bundle
// was causing errors.

document.addEventListener('DOMContentLoaded', function () {
  try {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('in');
    });

    // Photos in .ph frames start at opacity:0 (style.css) and fade in once
    // marked loaded — without this they stay invisible even after loading.
    document.querySelectorAll('.ph img').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', function () { img.classList.add('loaded'); }, { once: true });
      }
    });
  } catch (e) {
    // swallow errors to avoid breaking page rendering
    console.error('reveal-or-unhide error', e);
  }
});
