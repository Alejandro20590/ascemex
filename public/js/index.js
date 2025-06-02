document.addEventListener("DOMContentLoaded", () => {
  const ids = ["titulo-quienes", "texto-quienes", "titulo-valores", "mision", "vision", "objetivo"];

  ids.forEach(id => {
    const el = document.getElementById(id);
    const value = localStorage.getItem(id);
    if (el && value) {
      el.textContent = value;
    }
  });
});
