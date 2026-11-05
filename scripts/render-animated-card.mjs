export function renderAnimatedCard(card, thumbnail, escape) {
 const picture='<picture class="idor-thumbnail">'
  +'<source media="(prefers-reduced-motion: reduce)" srcset="'+escape(thumbnail.poster)+'">'
  +'<source type="image/webp" srcset="'+escape(thumbnail.animatedWebp)+'">'
  +'<img src="'+escape(thumbnail.src)+'" width="'+thumbnail.width+'" height="'+thumbnail.height+'" alt="'+escape(thumbnail.alt)+'" style="object-fit:contain" loading="lazy" decoding="async">'
  +'</picture><noscript><style>.idor-card-shell .idor-thumbnail{display:none}</style>'
  +'<img src="'+escape(thumbnail.poster)+'" width="'+thumbnail.width+'" height="'+thumbnail.height+'" alt="'+escape(thumbnail.alt)+'" style="object-fit:contain" loading="lazy" decoding="async"></noscript>';
 return '<div class="idor-card-shell">'+card.replace(/<img\b[^>]*>/,picture)+'</div>';
}
