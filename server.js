const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

// Configuración de multer para manejar archivos
const upload = multer({ dest: 'uploads/' });

// Middleware para analizar datos del formulario
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Carpeta para archivos estáticos

// Función para crear un PDF con los datos del formulario
function crearPDF(datos, archivoPath, archivoImagen = null) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(archivoPath);

        doc.pipe(stream);

        // Encabezado con logo
        doc.image(path.join(__dirname, 'public/img/logo.png'), 50, 50, { width: 100 });
        doc.text('ASCEMEX - Solicitud de Refacción', 200, 50, { align: 'right' });

        // Información del cliente
        doc.moveDown(3);
        doc.text(`Nombre: ${datos.nombre}`);
        doc.text(`Teléfono: ${datos.telefono}`);
        doc.text(`Correo: ${datos.correo}`);
        doc.text(`Tipo: ${datos.tipo}`);
        doc.text(`Marca: ${datos.marca}`);
        doc.text(`Descripción: ${datos.descripcion}`);

        // Agregar imagen si existe
        if (archivoImagen) {
            doc.addPage().image(archivoImagen, { fit: [500, 400], align: 'center' });
        }

        doc.end();
        stream.on('finish', () => resolve(archivoPath));
        stream.on('error', (err) => reject(err));
    });
}

// Ruta para manejar el envío del formulario
app.post('/enviar-solicitud', upload.single('imagen'), async (req, res) => {
    const { nombre, telefono, correo, tipo, marca, descripcion } = req.body;
    const archivo = req.file;
    const pdfPath = path.join(__dirname, `uploads/Solicitud_${Date.now()}.pdf`);

    // Configuración del transportador de Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'prueba010101011@gmail.com', // Cambia a tu correo de Gmail
            pass: 'pqqn ydxs ptak efzz', // Contraseña de aplicación
        },
    });

    // Crear el PDF
    try {
        await crearPDF({ nombre, telefono, correo, tipo, marca, descripcion }, pdfPath, archivo ? archivo.path : null);

        // Configurar el contenido del correo
        const mailOptions = {
            from: '"ASCEMEX" <prueba010101011@gmail.com>',
            to: 'prueba010101011@gmail.com', // Cambia esto al correo de destino
            subject: 'Nueva Solicitud de Refacción',
            text: `Detalles de la solicitud:
- Nombre Completo: ${nombre}
- Número de Teléfono: ${telefono}
- Correo: ${correo}
- Tipo: ${tipo}
- Marca: ${marca}
- Descripción: ${descripcion}`,
            attachments: [
                { filename: 'Solicitud.pdf', path: pdfPath },
                ...(archivo
                    ? [
                          {
                              filename: archivo.originalname,
                              path: archivo.path,
                          },
                      ]
                    : []),
            ],
        };

        // Enviar el correo
        await transporter.sendMail(mailOptions);

        // Eliminar archivos temporales
        fs.unlink(pdfPath, () => {});
        if (archivo) {
            fs.unlink(archivo.path, (err) => {
                if (err) console.error('Error al eliminar el archivo:', err);
            });
        }

        // Redirigir al cliente a la página de confirmación
        res.redirect('/confirmacion.html');
    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
        res.status(500).send('Error al procesar la solicitud. Intente nuevamente más tarde.');
    }
});

// Exporte la app para Vercel
module.exports = app;
