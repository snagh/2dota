/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shonen: {
          dark: '#0a0a0c',
          card: '#141419',
          primary: '#ff5a1f', // Laranja Shonen energético
          secondary: '#ffd200', // Amarelo Shonen
          accent: '#8257e5', // Roxo de Habilidade Especial
          health: '#4ade80', // Verde de vida
        }
      }
    },
  },
  plugins: [],
}
