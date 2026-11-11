/* Public configuration only. Secrets belong in the Cloudflare Worker. */
window.RABBIT_COMMUNITY = {
  api: ['localhost','127.0.0.1'].includes(location.hostname) ? 'http://localhost:8797' : 'https://community.rabbit-ears.stream',
  invite: 'https://discord.gg/Me827VV6',
};

