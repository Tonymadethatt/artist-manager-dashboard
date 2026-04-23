/** Dark-base styles for artist HTML emails. Shared by Vite preview and Netlify (relative imports only in consumers). */
export const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; }
    .email-body { padding: 22px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
    .hero-val { font-size: 36px !important; }
  }`
