document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-contenido');
  const mensaje = document.getElementById('mensaje');

  // Cargar contenido actual
  fetch('/api/contenido')
    .then(res => res.json())
    .then(data => {
      document.getElementById('quienesSomos').value = data.quienesSomos;
      document.getElementById('mision').value = data.mision;
      document.getElementById('vision').value = data.vision;
      document.getElementById('objetivo').value = data.objetivo;
    });

  // Guardar contenido
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = {
      quienesSomos: document.getElementById('quienesSomos').value,
      mision: document.getElementById('mision').value,
      vision: document.getElementById('vision').value,
      objetivo: document.getElementById('objetivo').value,
    };

    fetch('/guardar-cambios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    })
    .then(res => res.text())
    .then(data => {
      mensaje.textContent = data;
    })
    .catch(err => {
      mensaje.textContent = 'Error al guardar cambios';
      console.error(err);
    });
  });
});
