-- Update existing posts that use the broken postimg.cc fallback link to use the local site asset
update public.posts
set image_url = '/avian-map-final-logo.jpeg'
where image_url = 'https://i.postimg.cc/3JXmQBSp/avian-map-final-logo.jpg'
   or image_url like '%postimg.cc%';
