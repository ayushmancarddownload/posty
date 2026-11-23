function loadFeed() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  const autoPosters = JSON.parse(gallery.dataset.posters || '[]');
  let images = autoPosters.length > 0
    ? [...autoPosters]
    : (MY_GALLERY_IMAGES.length > 0
      ? [...MY_GALLERY_IMAGES]
      : Array.from({ length: 24 }, (_, i) => `https://picsum.photos/id/${i + 60}/600/800`));

  images = images.sort(() => Math.random() - 0.5);
  gallery.innerHTML = '';
  // ... baaki code same rahega
