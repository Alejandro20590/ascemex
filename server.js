require('dotenv').config();
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session'); 
const cheerio = require('cheerio'); 

const app = express();

const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
    session({
        secret: 'clave_secreta_segura',
        resave: false,
        saveUninitialized: false,
    })
);

const USUARIO_ADMIN = {
    usuario: 'admin',
    contrasena: 'admin123',
    correo: 'prueba010101011@gmail.com'
};

app.post('/login', (req, res) => {
    const { usuario, contrasena } = req.body;
    if (usuario === USUARIO_ADMIN.usuario && contrasena === USUARIO_ADMIN.contrasena) {
        req.session.usuario = usuario;
        return res.redirect('/admin.html');
    }
    return res.redirect('/login.html?error=1');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.post('/recuperar', async (req, res) => {
    const { correo } = req.body;

    if (correo !== USUARIO_ADMIN.correo) {
        return res.status(404).send('Correo no encontrado');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: '"ASCEMEX" <' + process.env.EMAIL_USER + '>',
        to: correo,
        subject: 'Recuperación de acceso - ASCEMEX',
        text: `Tus datos de acceso son:\nUsuario: ${USUARIO_ADMIN.usuario}\nContraseña: ${USUARIO_ADMIN.contrasena}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.redirect('/login.html?mensaje=correo_enviado');
    } catch (error) {
        console.error('Error al enviar correo de recuperación:', error);
        res.status(500).send('Error al enviar correo');
    }
});

function crearPDF(datos, archivoPath, archivoImagen = null) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(archivoPath);

        doc.pipe(stream);

        doc.image(path.join(__dirname, 'public/img/logo.png'), 50, 50, { width: 100 });
        doc.text('ASCEMEX - Solicitud de Refacción', 200, 50, { align: 'right' });

        doc.moveDown(3);
        doc.text(`Nombre: ${datos.nombre}`);
        doc.text(`Teléfono: ${datos.telefono}`);
        doc.text(`Correo: ${datos.correo}`);
        doc.text(`Tipo: ${datos.tipo}`);
        doc.text(`Marca: ${datos.marca}`);
        doc.text(`Descripción: ${datos.descripcion}`);

        if (archivoImagen) {
            doc.addPage().image(archivoImagen, { fit: [500, 400], align: 'center' });
        }

        doc.end();
        stream.on('finish', () => resolve(archivoPath));
        stream.on('error', (err) => reject(err));
    });
}

app.post('/enviar-solicitud', upload.single('imagen'), async (req, res) => {
    const { nombre, telefono, correo, tipo, marca, descripcion } = req.body;
    const archivo = req.file;
    const pdfPath = path.join(__dirname, `uploads/Solicitud_${Date.now()}.pdf`);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        await crearPDF({ nombre, telefono, correo, tipo, marca, descripcion }, pdfPath, archivo ? archivo.path : null);

        const mailOptions = {
            from: '"ASCEMEX" <prueba010101011@gmail.com>',
            to: 'prueba010101011@gmail.com',
            subject: 'Nueva Solicitud de Refacción',
            text: `Detalles de la solicitud:\n- Nombre Completo: ${nombre}\n- Número de Teléfono: ${telefono}\n- Correo: ${correo}\n- Tipo: ${tipo}\n- Marca: ${marca}\n- Descripción: ${descripcion}`,
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

        await transporter.sendMail(mailOptions);

        fs.unlink(pdfPath, () => {});
        if (archivo) {
            fs.unlink(archivo.path, (err) => {
                if (err) console.error('Error al eliminar el archivo:', err);
            });
        }

        res.redirect('/confirmacion.html');
    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
        res.status(500).send('Error al procesar la solicitud. Intente nuevamente más tarde.');
    }
});

const indexPath = path.join(__dirname, 'public', 'index.html');

app.get('/api/contenido', (req, res) => {
    fs.readFile(indexPath, 'utf8', (err, html) => {
        if (err) return res.status(500).json({ error: 'Error al leer index.html' });

        const $ = cheerio.load(html);

        const data = {
            quienesSomos: $('#quienes-somos p').text().trim(),
            mision: $('#valores .columna').eq(0).find('p').text().trim(),
            vision: $('#valores .columna').eq(1).find('p').text().trim(),
            objetivo: $('#valores .columna').eq(2).find('p').text().trim(),
        };

        res.json(data);
    });
});

app.post('/guardar-cambios', (req, res) => {
    const { quienesSomos, mision, vision, objetivo } = req.body;

    fs.readFile(indexPath, 'utf8', (err, html) => {
        if (err) return res.status(500).send('Error al leer index.html');

        const $ = cheerio.load(html);

        $('#quienes-somos p').text(quienesSomos);
        const columnas = $('#valores .columna');
        $(columnas[0]).find('p').text(mision);
        $(columnas[1]).find('p').text(vision);
        $(columnas[2]).find('p').text(objetivo);

        fs.writeFile(indexPath, $.html(), err => {
            if (err) return res.status(500).send('Error al guardar cambios');
            res.send('Cambios guardados correctamente');
        });
    });
});

// === NUEVO ===
const elevadoresJsonPath = path.join(__dirname, 'data', 'elevadores.json');
const elevadoresImgsPath = path.join(__dirname, 'public', 'elevadores');

if (!fs.existsSync(elevadoresImgsPath)) {
    fs.mkdirSync(elevadoresImgsPath, { recursive: true });
}
if (!fs.existsSync(path.dirname(elevadoresJsonPath))) {
    fs.mkdirSync(path.dirname(elevadoresJsonPath), { recursive: true });
}
if (!fs.existsSync(elevadoresJsonPath)) {
    fs.writeFileSync(elevadoresJsonPath, '[]', 'utf8');
}

const storageElevadores = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, elevadoresImgsPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'trabajo-' + uniqueSuffix + ext);
    }
});
const uploadElevadores = multer({ storage: storageElevadores });

app.get('/api/elevadores', (req, res) => {
    fs.readFile(elevadoresJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer trabajos' });
        let trabajos = [];
        try {
            trabajos = JSON.parse(data);
        } catch {
            trabajos = [];
        }
        res.json(trabajos);
    });
});

app.post('/api/elevadores', uploadElevadores.single('imagen'), (req, res) => {
    const descripcion = req.body.descripcion;
    const archivo = req.file;

    if (!archivo || !descripcion) {
        if (archivo) fs.unlinkSync(archivo.path);
        return res.status(400).json({ error: 'Falta imagen o descripción' });
    }

    fs.readFile(elevadoresJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer trabajos' });
        let trabajos = [];
        try {
            trabajos = JSON.parse(data);
        } catch {
            trabajos = [];
        }

        trabajos.push({ imagen: archivo.filename, descripcion });

        fs.writeFile(elevadoresJsonPath, JSON.stringify(trabajos, null, 2), err => {
            if (err) return res.status(500).json({ error: 'Error al guardar trabajo' });
            res.status(200).json({ mensaje: 'Trabajo guardado' });
        });
    });
});

app.delete('/api/elevadores/:imagen', (req, res) => {
    const imagen = req.params.imagen;

    fs.readFile(elevadoresJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer trabajos' });
        let trabajos = [];
        try {
            trabajos = JSON.parse(data);
        } catch {
            trabajos = [];
        }

        const trabajoIndex = trabajos.findIndex(t => t.imagen === imagen);
        if (trabajoIndex === -1) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        const rutaImagen = path.join(elevadoresImgsPath, imagen);
        fs.unlink(rutaImagen, (unlinkErr) => {
            if (unlinkErr) console.error('Error al borrar imagen:', unlinkErr);

            trabajos.splice(trabajoIndex, 1);

            fs.writeFile(elevadoresJsonPath, JSON.stringify(trabajos, null, 2), err => {
                if (err) return res.status(500).json({ error: 'Error al guardar cambios' });
                res.json({ mensaje: 'Trabajo eliminado' });
            });
        });
    });
});

// === NUEVO ESCALERAS ===
const escalerasJsonPath = path.join(__dirname, 'data', 'escaleras.json');
const escalerasImgsPath = path.join(__dirname, 'public', 'escaleras');

if (!fs.existsSync(escalerasImgsPath)) {
    fs.mkdirSync(escalerasImgsPath, { recursive: true });
}
if (!fs.existsSync(path.dirname(escalerasJsonPath))) {
    fs.mkdirSync(path.dirname(escalerasJsonPath), { recursive: true });
}
if (!fs.existsSync(escalerasJsonPath)) {
    fs.writeFileSync(escalerasJsonPath, '[]', 'utf8');
}

const storageEscaleras = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, escalerasImgsPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'trabajo-' + uniqueSuffix + ext);
    }
});
const uploadEscaleras = multer({ storage: storageEscaleras });

app.get('/api/escaleras', (req, res) => {
    fs.readFile(escalerasJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer trabajos escaleras' });
        let trabajos = [];
        try {
            trabajos = JSON.parse(data);
        } catch {
            trabajos = [];
        }
        res.json(trabajos);
    });
});

app.post('/api/escaleras', uploadEscaleras.single('imagen'), (req, res) => {
    const descripcion = req.body.descripcion;
    const archivo = req.file;

    if (!archivo || !descripcion) {
        if (archivo) fs.unlinkSync(archivo.path);
        return res.status(400).json({ error: 'Falta imagen o descripción' });
    }

    fs.readFile(escalerasJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer trabajos' });
        let trabajos = [];
        try {
            trabajos = JSON.parse(data);
        } catch {
            trabajos = [];
        }

        trabajos.push({ imagen: archivo.filename, descripcion });

        fs.writeFile(escalerasJsonPath, JSON.stringify(trabajos, null, 2), err => {
            if (err) return res.status(500).json({ error: 'Error al guardar trabajo' });
            res.status(200).json({ mensaje: 'Trabajo guardado' });
        });
    });
});

app.delete('/api/escaleras/:imagen', (req, res) => {
    const imagen = req.params.imagen;

    fs.readFile(escalerasJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer trabajos' });
        let trabajos = [];
        try {
            trabajos = JSON.parse(data);
        } catch {
            trabajos = [];
        }

        const trabajoIndex = trabajos.findIndex(t => t.imagen === imagen);
        if (trabajoIndex === -1) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        const rutaImagen = path.join(escalerasImgsPath, imagen);
        fs.unlink(rutaImagen, (unlinkErr) => {
            if (unlinkErr) console.error('Error al borrar imagen:', unlinkErr);

            trabajos.splice(trabajoIndex, 1);

            fs.writeFile(escalerasJsonPath, JSON.stringify(trabajos, null, 2), err => {
                if (err) return res.status(500).json({ error: 'Error al guardar cambios' });
                res.json({ mensaje: 'Trabajo eliminado' });
            });
        });
    }); 
});

// === NUEVO SERVICIOS ===
const serviciosJsonPath = path.join(__dirname, 'data', 'servicios.json');
const serviciosImgsPath = path.join(__dirname, 'public', 'servicios');

if (!fs.existsSync(serviciosImgsPath)) {
    fs.mkdirSync(serviciosImgsPath, { recursive: true });
}
if (!fs.existsSync(path.dirname(serviciosJsonPath))) {
    fs.mkdirSync(path.dirname(serviciosJsonPath), { recursive: true });
}
if (!fs.existsSync(serviciosJsonPath)) {
    fs.writeFileSync(serviciosJsonPath, '[]', 'utf8');
}

const storageServicios = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, serviciosImgsPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'servicio-' + uniqueSuffix + ext);
    }
});
const uploadServicios = multer({ storage: storageServicios });

app.get('/api/servicios', (req, res) => {
    fs.readFile(serviciosJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer servicios' });
        let servicios = [];
        try {
            servicios = JSON.parse(data);
        } catch {
            servicios = [];
        }
        res.json(servicios);
    });
});

app.post('/api/servicios', uploadServicios.single('imagen'), (req, res) => {
    const archivo = req.file;
    const descripcion = req.body.descripcion || '';

    if (!archivo || !descripcion) {
        if (archivo) fs.unlinkSync(archivo.path);
        return res.status(400).json({ error: 'Falta imagen o descripción' });
    }

    fs.readFile(serviciosJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer servicios' });
        let servicios = [];
        try {
            servicios = JSON.parse(data);
        } catch {
            servicios = [];
        }

        servicios.push({ imagen: archivo.filename, descripcion });

        fs.writeFile(serviciosJsonPath, JSON.stringify(servicios, null, 2), err => {
            if (err) return res.status(500).json({ error: 'Error al guardar servicio' });
            res.status(200).json({ mensaje: 'Servicio guardado' });
        });
    });
});



app.delete('/api/servicios/:imagen', (req, res) => {
    const imagen = req.params.imagen;

    fs.readFile(serviciosJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer servicios' });
        let servicios = [];
        try {
            servicios = JSON.parse(data);
        } catch {
            servicios = [];
        }

        const servicioIndex = servicios.findIndex(s => s.imagen === imagen);
        if (servicioIndex === -1) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        const rutaImagen = path.join(serviciosImgsPath, imagen);
        fs.unlink(rutaImagen, (unlinkErr) => {
            if (unlinkErr) console.error('Error al borrar imagen:', unlinkErr);

            servicios.splice(servicioIndex, 1);

            fs.writeFile(serviciosJsonPath, JSON.stringify(servicios, null, 2), err => {
                if (err) return res.status(500).json({ error: 'Error al guardar cambios' });
                res.json({ mensaje: 'Servicio eliminado' });
            });
        });
    });
});


// === NUEVO CLIENTES ===
const clientesJsonPath = path.join(__dirname, 'data', 'clientes.json');
const clientesImgsPath = path.join(__dirname, 'public', 'clientes');

if (!fs.existsSync(clientesImgsPath)) {
    fs.mkdirSync(clientesImgsPath, { recursive: true });
}
if (!fs.existsSync(path.dirname(clientesJsonPath))) {
    fs.mkdirSync(path.dirname(clientesJsonPath), { recursive: true });
}
if (!fs.existsSync(clientesJsonPath)) {
    fs.writeFileSync(clientesJsonPath, '[]', 'utf8');
}

const storageClientes = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, clientesImgsPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'cliente-' + uniqueSuffix + ext);
    }
});
const uploadClientes = multer({ storage: storageClientes });

app.get('/api/clientes', (req, res) => {
    fs.readFile(clientesJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer clientes' });
        let clientes = [];
        try {
            clientes = JSON.parse(data);
        } catch {
            clientes = [];
        }
        res.json(clientes);
    });
});

app.post('/api/clientes', uploadClientes.single('imagen'), (req, res) => {
    const nombre = req.body.nombre || '';
    const archivo = req.file;

    if (!archivo || !nombre) {
        if (archivo) fs.unlinkSync(archivo.path);
        return res.status(400).json({ error: 'Falta imagen o nombre' });
    }

    fs.readFile(clientesJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer clientes' });
        let clientes = [];
        try {
            clientes = JSON.parse(data);
        } catch {
            clientes = [];
        }

        clientes.push({ id: Date.now(), imagen: archivo.filename, nombre });

        fs.writeFile(clientesJsonPath, JSON.stringify(clientes, null, 2), err => {
            if (err) return res.status(500).json({ error: 'Error al guardar cliente' });
            res.status(200).json({ mensaje: 'Cliente guardado' });
        });
    });
});

app.delete('/api/clientes/:id', (req, res) => {
    const id = Number(req.params.id);

    fs.readFile(clientesJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer clientes' });
        let clientes = [];
        try {
            clientes = JSON.parse(data);
        } catch {
            clientes = [];
        }

        const index = clientes.findIndex(c => c.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const rutaImagen = path.join(clientesImgsPath, clientes[index].imagen);
        fs.unlink(rutaImagen, (unlinkErr) => {
            if (unlinkErr) console.error('Error al borrar imagen:', unlinkErr);

            clientes.splice(index, 1);

            fs.writeFile(clientesJsonPath, JSON.stringify(clientes, null, 2), err => {
                if (err) return res.status(500).json({ error: 'Error al guardar cambios' });
                res.json({ mensaje: 'Cliente eliminado' });
            });
        });
    });
});

// === REFACCIONES ===
const refaccionesJsonPath = path.join(__dirname, 'data', 'refacciones.json');
const refaccionesImgsPath = path.join(__dirname, 'public', 'refacciones');

if (!fs.existsSync(refaccionesImgsPath)) {
    fs.mkdirSync(refaccionesImgsPath, { recursive: true });
}
if (!fs.existsSync(path.dirname(refaccionesJsonPath))) {
    fs.mkdirSync(path.dirname(refaccionesJsonPath), { recursive: true });
}
if (!fs.existsSync(refaccionesJsonPath)) {
    fs.writeFileSync(refaccionesJsonPath, '[]', 'utf8');
}

const storageRefacciones = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, refaccionesImgsPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'refaccion-' + uniqueSuffix + ext);
    }
});
const uploadRefacciones = multer({ storage: storageRefacciones });

app.get('/api/refacciones', (req, res) => {
    fs.readFile(refaccionesJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer refacciones' });
        let refacciones = [];
        try {
            refacciones = JSON.parse(data);
        } catch {
            refacciones = [];
        }
        res.json(refacciones);
    });
});

app.post('/api/refacciones', uploadRefacciones.single('imagen'), (req, res) => {
    const descripcion = req.body.descripcion;
    const archivo = req.file;

    if (!archivo || !descripcion) {
        if (archivo) fs.unlinkSync(archivo.path);
        return res.status(400).json({ error: 'Falta imagen o descripción' });
    }

    fs.readFile(refaccionesJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer refacciones' });
        let refacciones = [];
        try {
            refacciones = JSON.parse(data);
        } catch {
            refacciones = [];
        }

        refacciones.push({ imagen: archivo.filename, descripcion });

        fs.writeFile(refaccionesJsonPath, JSON.stringify(refacciones, null, 2), err => {
            if (err) return res.status(500).json({ error: 'Error al guardar refacción' });
            res.status(200).json({ mensaje: 'Refacción guardada' });
        });
    });
});

app.delete('/api/refacciones/:imagen', (req, res) => {
    const imagen = req.params.imagen;

    fs.readFile(refaccionesJsonPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error al leer refacciones' });
        let refacciones = [];
        try {
            refacciones = JSON.parse(data);
        } catch {
            refacciones = [];
        }

        const index = refacciones.findIndex(r => r.imagen === imagen);
        if (index === -1) {
            return res.status(404).json({ error: 'Refacción no encontrada' });
        }

        const rutaImagen = path.join(refaccionesImgsPath, imagen);
        fs.unlink(rutaImagen, (unlinkErr) => {
            if (unlinkErr) console.error('Error al borrar imagen:', unlinkErr);

            refacciones.splice(index, 1);

            fs.writeFile(refaccionesJsonPath, JSON.stringify(refacciones, null, 2), err => {
                if (err) return res.status(500).json({ error: 'Error al guardar cambios' });
                res.json({ mensaje: 'Refacción eliminada' });
            });
        });
    });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
