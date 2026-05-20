const SUPABASE_URL = "https://ugilmrripmnuwbqwlweq.supabase.co";
const SUPABASE_KEY = "sb_publishable_17XU89b3ItWFRzu5KWBOFQ_I9qHs2ne";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Número de WhatsApp de la empresa ──
// Cámbialo por tu número en formato internacional sin + ni espacios
const EMPRESA_WHATSAPP = "573001234567";
const EMPRESA_NOMBRE = "FacturNet Internet";
const EMPRESA_NIT = "900.123.456-7";

let todosClientes = [];
let clienteFactura = null;

// ═══════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════
function mostrarSeccion(nombre) {
    document.querySelectorAll('.seccion').forEach(s => s.classList.add('oculto'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + nombre).classList.remove('oculto');
    event?.target?.closest('.nav-item')?.classList.add('active');

    if (nombre === 'clientes') listarClientes();
    if (nombre === 'dashboard') cargarDashboard();
}

// ═══════════════════════════════════════
// GUARDAR / EDITAR CLIENTE
// ═══════════════════════════════════════
async function guardarCliente() {
    const id = document.getElementById('editId').value;
    const datos = {
        nombre:        document.getElementById('nombre').value.trim(),
        telefono:      document.getElementById('telefono').value.trim(),
        correo:        document.getElementById('correo').value.trim(),
        direccion:     document.getElementById('direccion').value.trim(),
        plan:          document.getElementById('plan').value.trim(),
        valor_mensual: parseFloat(document.getElementById('valor').value) || 0,
        fecha_inicio:  document.getElementById('fecha_inicio').value,
        fecha_corte:   document.getElementById('fecha_corte').value,
        estado:        document.getElementById('estado').value
    };

    if (!datos.nombre || !datos.telefono) {
        toast('Nombre y teléfono son obligatorios', 'error');
        return;
    }

    let error;
    if (id) {
        ({ error } = await client.from('clientes').update(datos).eq('id', id));
    } else {
        ({ error } = await client.from('clientes').insert([datos]));
    }

    if (error) { toast('Error guardando cliente', 'error'); console.error(error); return; }

    toast(id ? 'Cliente actualizado' : 'Cliente guardado', 'exito');
    limpiarFormulario();
    mostrarSeccion('clientes');
    listarClientes();
    cargarDashboard();
}

function editarCliente(id) {
    const c = todosClientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('editId').value = c.id;
    document.getElementById('nombre').value       = c.nombre || '';
    document.getElementById('telefono').value     = c.telefono || '';
    document.getElementById('correo').value       = c.correo || '';
    document.getElementById('direccion').value    = c.direccion || '';
    document.getElementById('plan').value         = c.plan || '';
    document.getElementById('valor').value        = c.valor_mensual || '';
    document.getElementById('fecha_inicio').value = c.fecha_inicio || '';
    document.getElementById('fecha_corte').value  = c.fecha_corte || '';
    document.getElementById('estado').value       = c.estado || 'activo';
    document.getElementById('tituloFormulario').textContent = 'Editar Cliente';
    mostrarSeccion('nuevo');
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente?')) return;
    const { error } = await client.from('clientes').delete().eq('id', id);
    if (error) { toast('Error eliminando', 'error'); return; }
    toast('Cliente eliminado', 'exito');
    listarClientes();
    cargarDashboard();
}

function cancelarEdicion() {
    limpiarFormulario();
    mostrarSeccion('clientes');
}

function limpiarFormulario() {
    ['editId','nombre','telefono','correo','direccion','plan','valor','fecha_inicio','fecha_corte'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('estado').value = 'activo';
    document.getElementById('tituloFormulario').textContent = 'Nuevo Cliente';
}

// ═══════════════════════════════════════
// LISTAR CLIENTES
// ═══════════════════════════════════════
async function listarClientes() {
    const { data, error } = await client.from('clientes').select('*').order('nombre');
    if (error) { console.error(error); return; }
    todosClientes = data || [];
    renderTabla(todosClientes);
    document.getElementById('totalClientes').textContent = todosClientes.length + ' clientes';
}

function renderTabla(lista) {
    const tbody = document.getElementById('tablaClientes');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text2)">No hay clientes</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(c => `
        <tr>
            <td>
                <div style="font-weight:500">${c.nombre}</div>
                <div style="font-size:12px;color:var(--text2)">${c.telefono}</div>
            </td>
            <td>${c.plan || '—'}</td>
            <td style="font-weight:600;color:var(--verde)">$${Number(c.valor_mensual || 0).toLocaleString('es-CO')}</td>
            <td style="font-size:13px">${formatFecha(c.fecha_corte)}</td>
            <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
            <td>
                <div class="acciones">
                    <button class="btn-accion factura" onclick="generarFactura(${c.id})">Factura</button>
                    <button class="btn-accion editar" onclick="editarCliente(${c.id})">Editar</button>
                    <button class="btn-accion borrar" onclick="eliminarCliente(${c.id})">Borrar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filtrarClientes() {
    const busqueda = document.getElementById('busqueda').value.toLowerCase();
    const estado   = document.getElementById('filtroEstado').value;
    const filtrado = todosClientes.filter(c => {
        const coincideBusqueda = c.nombre?.toLowerCase().includes(busqueda) ||
                                 c.telefono?.includes(busqueda) ||
                                 c.correo?.toLowerCase().includes(busqueda);
        const coincideEstado   = !estado || c.estado === estado;
        return coincideBusqueda && coincideEstado;
    });
    renderTabla(filtrado);
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function cargarDashboard() {
    if (!todosClientes.length) await listarClientes();
    const total    = todosClientes.length;
    const activos  = todosClientes.filter(c => c.estado === 'activo').length;
    const mora     = todosClientes.filter(c => c.estado === 'mora').length;
    const factura  = todosClientes.reduce((s, c) => s + Number(c.valor_mensual || 0), 0);

    document.getElementById('statTotal').textContent   = total;
    document.getElementById('statActivos').textContent = activos;
    document.getElementById('statMora').textContent    = mora;
    document.getElementById('statValor').textContent   = '$' + factura.toLocaleString('es-CO');
    document.getElementById('totalClientes').textContent = total + ' clientes';

    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaHoy').textContent = formatFecha(hoy);

    const cortesHoy = todosClientes.filter(c => c.fecha_corte === hoy);
    const lista = document.getElementById('listaCortes');
    if (!cortesHoy.length) {
        lista.innerHTML = '<p style="color:var(--text2);font-size:14px">No hay cortes programados para hoy.</p>';
    } else {
        lista.innerHTML = cortesHoy.map(c => `
            <div class="corte-item">
                <div>
                    <div class="corte-nombre">${c.nombre}</div>
                    <div class="corte-info">${c.telefono} · ${c.plan}</div>
                </div>
                <div class="corte-valor">$${Number(c.valor_mensual).toLocaleString('es-CO')}</div>
                <button class="btn-accion factura" onclick="generarFactura(${c.id})">Generar Factura</button>
            </div>
        `).join('');
    }
}

// ═══════════════════════════════════════
// GENERACIÓN DE FACTURA (PDF)
// ═══════════════════════════════════════
function generarFactura(id) {
    clienteFactura = todosClientes.find(c => c.id === id);
    if (!clienteFactura) return;

    const num = 'FAC-' + String(Date.now()).slice(-6);
    const hoy = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
    const vence = calcularVencimiento(clienteFactura.fecha_corte);
    const valor = Number(clienteFactura.valor_mensual || 0);

    document.getElementById('previewFactura').innerHTML = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:480px;margin:0 auto">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #3b82f6">
                <div>
                    <div style="font-size:22px;font-weight:700;color:#3b82f6">⚡ ${EMPRESA_NOMBRE}</div>
                    <div style="font-size:12px;color:#666;margin-top:4px">NIT: ${EMPRESA_NIT}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:13px;font-weight:600">FACTURA</div>
                    <div style="font-size:13px;color:#3b82f6;font-weight:700">${num}</div>
                    <div style="font-size:12px;color:#666;margin-top:2px">${hoy}</div>
                </div>
            </div>

            <div style="margin-bottom:20px">
                <div style="font-size:11px;color:#666;text-transform:uppercase;font-weight:600;margin-bottom:8px">Facturar a</div>
                <div style="font-weight:600;font-size:15px">${clienteFactura.nombre}</div>
                <div style="font-size:13px;color:#444;margin-top:2px">${clienteFactura.telefono}</div>
                <div style="font-size:13px;color:#444">${clienteFactura.correo || ''}</div>
                <div style="font-size:13px;color:#444">${clienteFactura.direccion || ''}</div>
            </div>

            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <thead>
                    <tr style="background:#f1f5f9">
                        <th style="padding:10px;text-align:left;font-size:12px;color:#64748b">DESCRIPCIÓN</th>
                        <th style="padding:10px;text-align:right;font-size:12px;color:#64748b">VALOR</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom:1px solid #e2e8f0">
                        <td style="padding:12px 10px">
                            <div style="font-weight:500">${clienteFactura.plan}</div>
                            <div style="font-size:12px;color:#64748b">Servicio mensual · Corte: ${formatFecha(clienteFactura.fecha_corte)}</div>
                        </td>
                        <td style="padding:12px 10px;text-align:right;font-weight:600">$${valor.toLocaleString('es-CO')}</td>
                    </tr>
                </tbody>
            </table>

            <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
                <div style="min-width:200px">
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #e2e8f0">
                        <span style="color:#64748b;font-size:13px">Subtotal</span>
                        <span style="font-size:13px">$${valor.toLocaleString('es-CO')}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #111">
                        <span style="font-weight:700">TOTAL</span>
                        <span style="font-weight:700;font-size:16px;color:#3b82f6">$${valor.toLocaleString('es-CO')}</span>
                    </div>
                </div>
            </div>

            <div style="background:#f8fafc;border-radius:8px;padding:14px;font-size:12px;color:#64748b">
                <strong style="color:#111">Pagar antes del:</strong> ${vence}<br>
                Consignar a nombre de <strong>${EMPRESA_NOMBRE}</strong><br>
                Preguntas: comuníquese al ${EMPRESA_WHATSAPP.slice(-10)}
            </div>
        </div>
    `;
    document.getElementById('modalFactura').classList.remove('oculto');
}

function cerrarModal() {
    document.getElementById('modalFactura').classList.add('oculto');
    clienteFactura = null;
}

// ═══════════════════════════════════════
// DESCARGAR PDF con jsPDF
// ═══════════════════════════════════════
function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const c = clienteFactura;
    const valor = Number(c.valor_mensual || 0);
    const num = 'FAC-' + String(Date.now()).slice(-6);

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('⚡ ' + EMPRESA_NOMBRE, 14, 14);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('NIT: ' + EMPRESA_NIT, 14, 22);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('FACTURA ' + num, 196, 14, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-CO'), 196, 22, { align: 'right' });

    // Client info
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', 14, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(c.nombre, 14, 52);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(c.telefono || '', 14, 58);
    doc.text(c.correo || '', 14, 63);
    doc.text(c.direccion || '', 14, 68);

    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 78, 182, 9, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('DESCRIPCIÓN', 18, 84);
    doc.text('VALOR', 192, 84, { align: 'right' });

    // Table row
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(c.plan || 'Servicio', 18, 96);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Servicio mensual · Corte: ' + formatFecha(c.fecha_corte), 18, 102);
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('$' + valor.toLocaleString('es-CO'), 192, 96, { align: 'right' });
    doc.line(14, 108, 196, 108);

    // Total
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('TOTAL: $' + valor.toLocaleString('es-CO'), 192, 118, { align: 'right' });

    // Footer note
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Pagar antes del: ' + calcularVencimiento(c.fecha_corte), 14, 135);
    doc.text('Gracias por preferir ' + EMPRESA_NOMBRE, 14, 140);

    doc.save('factura-' + c.nombre.replace(/\s+/g, '-').toLowerCase() + '.pdf');
    toast('PDF descargado', 'exito');
}

// ═══════════════════════════════════════
// ENVIAR POR WHATSAPP
// ═══════════════════════════════════════
function enviarWhatsApp() {
    if (!clienteFactura) return;
    const c = clienteFactura;
    const valor = Number(c.valor_mensual || 0);
    const vence = calcularVencimiento(c.fecha_corte);
    
    // Número del cliente (eliminar caracteres que no sean dígitos)
    const tel = c.telefono?.replace(/\D/g, '');
    if (!tel) { toast('El cliente no tiene teléfono registrado', 'error'); return; }

    // Agregar código de país Colombia si no lo tiene (57)
    const telCompleto = tel.startsWith('57') ? tel : '57' + tel;

    const mensaje = `Hola ${c.nombre} 👋

*${EMPRESA_NOMBRE}* le informa que su factura del mes está lista:

📋 *Plan:* ${c.plan}
💰 *Valor:* $${valor.toLocaleString('es-CO')}
📅 *Fecha de corte:* ${formatFecha(c.fecha_corte)}
⏰ *Pagar antes del:* ${vence}

Para cualquier consulta comuníquese con nosotros.
¡Gracias por su preferencia! 🙏`;

    const url = `https://wa.me/${telCompleto}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    toast('Abriendo WhatsApp...', 'exito');
}

// ═══════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════
function formatFecha(fecha) {
    if (!fecha) return '—';
    const [y, m, d] = fecha.split('-');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${meses[parseInt(m)-1]} ${y}`;
}

function calcularVencimiento(fechaCorte) {
    if (!fechaCorte) return '—';
    const f = new Date(fechaCorte + 'T00:00:00');
    f.setDate(f.getDate() + 5);
    return f.toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
}

function toast(msg, tipo = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + tipo;
    t.classList.remove('oculto');
    setTimeout(() => t.classList.add('oculto'), 3000);
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaHoy').textContent = formatFecha(hoy);
    await listarClientes();
    cargarDashboard();
});