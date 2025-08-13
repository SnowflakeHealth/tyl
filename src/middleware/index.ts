import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);
  
  // Redirect naked domain to www
  if (url.hostname === 'trackyourlabs.com') {
    const wwwUrl = new URL(url);
    wwwUrl.hostname = 'www.trackyourlabs.com';
    
    return Response.redirect(wwwUrl.toString(), 301);
  }
  
  return next();
});