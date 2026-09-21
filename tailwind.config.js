/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      "dark",
      {
        corporate: {
          ...require("daisyui/src/theming/themes")["corporate"],
          "primary-content": "#ffffff",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "1.9rem",
          "--tab-radius": "0.5rem",
          "--animation-btn": "0.25s",
          "--animation-input": "0.2s",
          "--btn-focus-scale": "0.95"
        }
      }
    ],
  },
}
