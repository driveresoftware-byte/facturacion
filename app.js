const SUPABASE_URL = "https://ugilmrripmnuwbqwlweq.supabase.co";
const SUPABASE_KEY = "sb_publishable_17XU89b3ItWFRzu5KWBOFQ_I9qHs2ne";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const EMPRESA_WHATSAPP = "573001234567";
const EMPRESA_NOMBRE   = "FacturNet Internet";
const EMPRESA_NIT      = "900.123.456-7";

let todosClientes  = [];
let todosPagos     = [];
let clienteFactura = null;
let envioActivo    = false;
let detenerFlag    = false;

// ═══════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════
function mesActual() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function formatFecha(fecha) {
    if (!fecha) return '—';
    const [y, m, d] = fecha.split('-');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${meses[parseInt(m) - 1]} ${y}`;
}

function calcularVencimiento(fechaCorte) {
    if (!fechaCorte) return '—';
    const f = new Date(fechaCorte + 'T00:00:00');
    f.setDate(f.getDate() + 5);
    return f.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

function calcularDiasMora(fechaCorte) {
    if (!fechaCorte) return 0;
    const hoy    = new Date();
    hoy.setHours(0, 0, 0, 0);
    const corte  = new Date(fechaCorte + 'T00:00:00');
    const diff   = Math.floor((hoy - corte) / 86400000);
    return diff > 0 ? diff : 0;
}

function limpiarTelefono(tel) {
    if (!tel) return '';
    const solo = String(tel).replace(/\D/g, '');
    return solo.startsWith('57') ? solo : '57' + solo;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function toast(msg, tipo = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + tipo;
    t.classList.remove('oculto');
    setTimeout(() => t.classList.add('oculto'), 3200);
}

// ═══════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════
function mostrarSeccion(nombre, el) {
    document.querySelectorAll('.seccion').forEach(s => s.classList.add('oculto'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + nombre).classList.remove('oculto');
    (el || event?.target?.closest('.nav-item'))?.classList.add('active');

    if (nombre === 'dashboard') cargarDashboard();
    if (nombre === 'clientes')  listarClientes();
    if (nombre === 'pagos')     { poblarSelectorMes(); cargarPagos(); }
    if (nombre === 'envio')     iniciarSeccionEnvio();
}

// ═══════════════════════════════════════
// CLIENTES — CRUD
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
        toast('Nombre y teléfono son obligatorios', 'error'); return;
    }

    let error;
    if (id) {
        ({ error } = await client.from('clientes').update(datos).eq('id', id));
    } else {
        ({ error } = await client.from('clientes').insert([datos]));
    }

    if (error) { toast('Error guardando cliente', 'error'); console.error(error); return; }
    toast(id ? 'Cliente actualizado ✓' : 'Cliente guardado ✓', 'exito');
    limpiarFormulario();
    await listarClientes();
    mostrarSeccion('clientes', document.querySelectorAll('.nav-item')[2]);
    cargarDashboard();
}

function editarCliente(id) {
    const c = todosClientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('editId').value        = c.id;
    document.getElementById('nombre').value        = c.nombre        || '';
    document.getElementById('telefono').value      = c.telefono      || '';
    document.getElementById('correo').value        = c.correo        || '';
    document.getElementById('direccion').value     = c.direccion     || '';
    document.getElementById('plan').value          = c.plan          || '';
    document.getElementById('valor').value         = c.valor_mensual || '';
    document.getElementById('fecha_inicio').value  = c.fecha_inicio  || '';
    document.getElementById('fecha_corte').value   = c.fecha_corte   || '';
    document.getElementById('estado').value        = c.estado        || 'activo';
    document.getElementById('tituloFormulario').textContent = 'Editar Cliente';
    mostrarSeccion('nuevo', document.querySelectorAll('.nav-item')[1]);
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente y todos sus registros?')) return;
    const { error } = await client.from('clientes').delete().eq('id', id);
    if (error) { toast('Error eliminando', 'error'); return; }
    toast('Cliente eliminado', 'exito');
    await listarClientes();
    cargarDashboard();
}

function cancelarEdicion() { limpiarFormulario(); mostrarSeccion('clientes', document.querySelectorAll('.nav-item')[2]); }

function limpiarFormulario() {
    ['editId','nombre','telefono','correo','direccion','plan','valor','fecha_inicio','fecha_corte']
        .forEach(id => document.getElementById(id).value = '');
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

    // Cargar pagos del mes actual para saber quién pagó
    const mes = mesActual();
    const { data: pagosData } = await client.from('pagos').select('cliente_id').eq('mes', mes);
    const pagadosIds = new Set((pagosData || []).map(p => p.cliente_id));

    document.getElementById('totalClientes').textContent = todosClientes.length + ' clientes';
    renderTabla(todosClientes, pagadosIds);
    return pagadosIds;
}

function renderTabla(lista, pagadosIds) {
    const mes = mesActual();
    const tbody = document.getElementById('tablaClientes');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text2)">No hay clientes</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(c => {
        const pagado  = pagadosIds ? pagadosIds.has(c.id) : false;
        const mora    = calcularDiasMora(c.fecha_corte);
        const moraTag = pagado
            ? `<span class="mora-tag ninguno">—</span>`
            : mora > 30
                ? `<span class="mora-tag">${mora} días</span>`
                : mora > 0
                    ? `<span class="mora-tag leve">${mora} días</span>`
                    : `<span class="mora-tag ninguno">Al día</span>`;

        const estadoBadge = pagado
            ? `<span class="badge badge-pagado">Pagado ✓</span>`
            : `<span class="badge badge-${c.estado}">${c.estado}</span>`;

        return `<tr>
            <td>
                <div style="font-weight:500">${c.nombre}</div>
                <div style="font-size:12px;color:var(--text2)">${c.telefono}</div>
            </td>
            <td>
                <div>${c.plan || '—'}</div>
                <div style="font-size:12px;color:var(--verde);font-weight:600">$${Number(c.valor_mensual || 0).toLocaleString('es-CO')}</div>
            </td>
            <td style="font-size:13px">${formatFecha(c.fecha_corte)}</td>
            <td>${moraTag}</td>
            <td>${estadoBadge}</td>
            <td>
                <div class="acciones">
                    ${pagado
                        ? `<button class="btn-accion" onclick="anularPago(${c.id})" style="border-color:var(--amarillo);color:var(--amarillo)">Anular pago</button>`
                        : `<button class="btn-accion factura" onclick="abrirModalPago(${c.id})">✓ Pago</button>`
                    }
                    <button class="btn-accion factura" onclick="generarFactura(${c.id})">Factura</button>
                    <button class="btn-accion editar" onclick="editarCliente(${c.id})">Editar</button>
                    <button class="btn-accion borrar" onclick="eliminarCliente(${c.id})">Borrar</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function filtrarClientes() {
    const busqueda = document.getElementById('busqueda').value.toLowerCase();
    const estado   = document.getElementById('filtroEstado').value;
    const mes      = mesActual();

    const { data: pagosData } = await client.from('pagos').select('cliente_id').eq('mes', mes);
    const pagadosIds = new Set((pagosData || []).map(p => p.cliente_id));

    let filtrado = todosClientes.filter(c => {
        const coincide = c.nombre?.toLowerCase().includes(busqueda) ||
                         c.telefono?.includes(busqueda) ||
                         c.correo?.toLowerCase().includes(busqueda);
        if (!coincide) return false;
        if (estado === 'pagado') return pagadosIds.has(c.id);
        if (estado) return c.estado === estado;
        return true;
    });
    renderTabla(filtrado, pagadosIds);
}

// ═══════════════════════════════════════
// PAGOS — registrar, anular, listar
// ═══════════════════════════════════════
function abrirModalPago(clienteId) {
    const c = todosClientes.find(x => x.id === clienteId);
    if (!c) return;
    document.getElementById('pagoClienteId').value    = c.id;
    document.getElementById('pagoClienteNombre').textContent = c.nombre;
    document.getElementById('pagoValor').value        = c.valor_mensual || '';
    document.getElementById('pagoFecha').value        = new Date().toISOString().split('T')[0];
    document.getElementById('pagoObservacion').value  = '';
    document.getElementById('modalPago').classList.remove('oculto');
}

function cerrarModalPago() {
    document.getElementById('modalPago').classList.add('oculto');
}

async function confirmarPago() {
    const clienteId  = parseInt(document.getElementById('pagoClienteId').value);
    const valorPagado = parseFloat(document.getElementById('pagoValor').value) || 0;
    const fechaPago  = document.getElementById('pagoFecha').value;
    const observacion = document.getElementById('pagoObservacion').value.trim();
    const mes        = mesActual();

    const { error } = await client.from('pagos').upsert({
        cliente_id:   clienteId,
        mes,
        fecha_pago:   fechaPago,
        valor_pagado: valorPagado,
        observacion
    }, { onConflict: 'cliente_id,mes' });

    if (error) { toast('Error registrando pago', 'error'); console.error(error); return; }

    // Si el cliente estaba en mora, volver a activo
    const c = todosClientes.find(x => x.id === clienteId);
    if (c && c.estado === 'mora') {
        await client.from('clientes').update({ estado: 'activo' }).eq('id', clienteId);
    }

    toast(`Pago de ${c?.nombre} registrado ✓`, 'exito');
    cerrarModalPago();
    await listarClientes();
    cargarDashboard();
}

async function anularPago(clienteId) {
    const c   = todosClientes.find(x => x.id === clienteId);
    const mes = mesActual();
    if (!confirm(`¿Anular el pago de ${c?.nombre} del mes ${mes}?`)) return;

    const { error } = await client.from('pagos').delete()
        .eq('cliente_id', clienteId).eq('mes', mes);

    if (error) { toast('Error anulando pago', 'error'); return; }
    toast('Pago anulado', 'exito');
    await listarClientes();
    cargarDashboard();
}

// ─── Sección de Pagos ───────────────────
function poblarSelectorMes() {
    const sel = document.getElementById('filtroPagoMes');
    const hoy = new Date();
    sel.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        sel.innerHTML += `<option value="${val}" ${i === 0 ? 'selected' : ''}>${label}</option>`;
    }
}

async function cargarPagos() {
    const mes = document.getElementById('filtroPagoMes')?.value || mesActual();

    const { data: pagosData, error } = await client.from('pagos')
        .select('*, clientes(nombre, plan, valor_mensual, fecha_corte, estado)')
        .eq('mes', mes);

    if (error) { console.error(error); return; }
    todosPagos = pagosData || [];

    // Todos los clientes activos/mora vs los que pagaron ese mes
    const pagadosIds  = new Set(todosPagos.map(p => p.cliente_id));
    const pendientes  = todosClientes.filter(c =>
        !pagadosIds.has(c.id) && ['activo','mora'].includes(c.estado)
    );

    const totalRecaudado = todosPagos.reduce((s, p) => s + Number(p.valor_pagado || 0), 0);
    document.getElementById('pagosCount').textContent     = todosPagos.length;
    document.getElementById('pendientesCount').textContent = pendientes.length;
    document.getElementById('recaudadoMes').textContent   = '$' + totalRecaudado.toLocaleString('es-CO');

    const tbody = document.getElementById('tablaPagos');

    // Filas de pagados
    const filasPagados = todosPagos.map(p => {
        const c    = p.clientes || {};
        const mora = calcularDiasMora(c.fecha_corte);
        return `<tr>
            <td>
                <div style="font-weight:500">${c.nombre || '—'}</div>
            </td>
            <td>${c.plan || '—'}</td>
            <td style="color:var(--verde);font-weight:600">$${Number(p.valor_pagado || 0).toLocaleString('es-CO')}</td>
            <td><span class="badge badge-pagado">Pagado ✓</span></td>
            <td style="font-size:13px">${formatFecha(p.fecha_pago)}</td>
            <td><span class="mora-tag ninguno">—</span></td>
            <td>
                <button class="btn-accion" onclick="anularPago(${p.cliente_id})"
                    style="border-color:var(--amarillo);color:var(--amarillo);font-size:11px">Anular</button>
            </td>
        </tr>`;
    });

    // Filas de pendientes
    const filasPendientes = pendientes.map(c => {
        const mora = calcularDiasMora(c.fecha_corte);
        const moraTag = mora > 30
            ? `<span class="mora-tag">${mora} días</span>`
            : mora > 0
                ? `<span class="mora-tag leve">${mora} días</span>`
                : `<span class="mora-tag ninguno">Al día</span>`;
        return `<tr>
            <td>
                <div style="font-weight:500">${c.nombre}</div>
                <div style="font-size:12px;color:var(--text2)">${c.telefono}</div>
            </td>
            <td>${c.plan || '—'}</td>
            <td style="color:var(--verde);font-weight:600">$${Number(c.valor_mensual || 0).toLocaleString('es-CO')}</td>
            <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
            <td style="color:var(--text2);font-size:13px">Pendiente</td>
            <td>${moraTag}</td>
            <td>
                <button class="btn-accion factura" onclick="abrirModalPago(${c.id})">✓ Registrar pago</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = filasPagados.join('') + filasPendientes.join('') ||
        '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text2)">Sin datos</td></tr>';
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function cargarDashboard() {
    if (!todosClientes.length) await listarClientes();

    const mes     = mesActual();
    const { data: pagosData } = await client.from('pagos').select('cliente_id, valor_pagado').eq('mes', mes);
    const pagadosIds = new Set((pagosData || []).map(p => p.cliente_id));
    const recaudado  = (pagosData || []).reduce((s, p) => s + Number(p.valor_pagado || 0), 0);

    const total    = todosClientes.length;
    const activos  = todosClientes.filter(c => c.estado === 'activo').length;
    const mora     = todosClientes.filter(c => c.estado === 'mora').length;
    const factura  = todosClientes.reduce((s, c) => s + Number(c.valor_mensual || 0), 0);
    const pagados  = pagadosIds.size;

    document.getElementById('statTotal').textContent     = total;
    document.getElementById('statActivos').textContent   = activos;
    document.getElementById('statMora').textContent      = mora;
    document.getElementById('statPagados').textContent   = pagados;
    document.getElementById('statValor').textContent     = '$' + factura.toLocaleString('es-CO');
    document.getElementById('statRecaudado').textContent = '$' + recaudado.toLocaleString('es-CO');
    document.getElementById('totalClientes').textContent = total + ' clientes';

    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaHoy').textContent = formatFecha(hoy);

    const cortesHoy = todosClientes.filter(c => c.fecha_corte === hoy);
    const lista = document.getElementById('listaCortes');
    if (!cortesHoy.length) {
        lista.innerHTML = '<p style="color:var(--text2);font-size:14px">No hay cortes programados para hoy.</p>';
    } else {
        lista.innerHTML = cortesHoy.map(c => {
            const pagado = pagadosIds.has(c.id);
            return `<div class="corte-item">
                <div>
                    <div class="corte-nombre">${c.nombre}</div>
                    <div class="corte-info">${c.telefono} · ${c.plan}</div>
                </div>
                <div class="corte-valor">$${Number(c.valor_mensual).toLocaleString('es-CO')}</div>
                ${pagado
                    ? `<span class="badge badge-pagado">Pagado ✓</span>`
                    : `<button class="btn-accion factura" onclick="abrirModalPago(${c.id})">✓ Registrar pago</button>`
                }
                <button class="btn-accion factura" onclick="generarFactura(${c.id})">Factura</button>
            </div>`;
        }).join('');
    }
}

// ═══════════════════════════════════════
// ENVÍO MASIVO
// ═══════════════════════════════════════
async function iniciarSeccionEnvio() {
    if (!todosClientes.length) await listarClientes();
    // Marcar primera opción por defecto si no hay ninguna seleccionada
    const radios = document.querySelectorAll('input[name="destinatarios"]');
    const alguno = [...radios].some(r => r.checked);
    if (!alguno) radios[0].checked = true;
    previsualizarEnvio();
}

async function previsualizarEnvio() {
    const modo = document.querySelector('input[name="destinatarios"]:checked')?.value;
    if (!modo) return;

    const mes = mesActual();
    const { data: pagosData } = await client.from('pagos').select('cliente_id').eq('mes', mes);
    const pagadosIds = new Set((pagosData || []).map(p => p.cliente_id));
    const hoy = new Date().toISOString().split('T')[0];

    let lista = [];
    if (modo === 'todos')      lista = todosClientes.filter(c => c.estado === 'activo');
    if (modo === 'mora')       lista = todosClientes.filter(c => c.estado === 'mora');
    if (modo === 'corte_hoy')  lista = todosClientes.filter(c => c.fecha_corte === hoy);
    if (modo === 'sin_pagar')  lista = todosClientes.filter(c =>
        ['activo','mora'].includes(c.estado) && !pagadosIds.has(c.id)
    );

    document.getElementById('previewCount').textContent = lista.length;
    document.getElementById('envioPreview').style.display = lista.length ? 'block' : 'none';

    document.getElementById('listaPreview').innerHTML = lista.slice(0, 50).map((c, i) => {
        const mora  = calcularDiasMora(c.fecha_corte);
        const extra = mora > 0
            ? `<span class="mora-tag leve" style="margin-left:6px">${mora}d mora</span>`
            : '';
        return `<div class="preview-item">
            <div class="preview-num">${i + 1}</div>
            <div class="preview-info">
                <div class="preview-nombre">${c.nombre} ${extra}</div>
                <div class="preview-tel">${c.telefono}</div>
            </div>
            <div class="preview-valor">$${Number(c.valor_mensual || 0).toLocaleString('es-CO')}</div>
        </div>`;
    }).join('') + (lista.length > 50
        ? `<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px">... y ${lista.length - 50} más</div>`
        : '');
}

async function iniciarEnvioMasivo() {
    if (envioActivo) return;

    const modo = document.querySelector('input[name="destinatarios"]:checked')?.value;
    const plantilla = document.getElementById('plantillaMensaje').value;
    if (!modo || !plantilla.trim()) { toast('Selecciona destinatarios y escribe un mensaje', 'error'); return; }

    const mes = mesActual();
    const { data: pagosData } = await client.from('pagos').select('cliente_id').eq('mes', mes);
    const pagadosIds = new Set((pagosData || []).map(p => p.cliente_id));
    const hoy = new Date().toISOString().split('T')[0];

    let lista = [];
    if (modo === 'todos')      lista = todosClientes.filter(c => c.estado === 'activo');
    if (modo === 'mora')       lista = todosClientes.filter(c => c.estado === 'mora');
    if (modo === 'corte_hoy')  lista = todosClientes.filter(c => c.fecha_corte === hoy);
    if (modo === 'sin_pagar')  lista = todosClientes.filter(c =>
        ['activo','mora'].includes(c.estado) && !pagadosIds.has(c.id)
    );

    if (!lista.length) { toast('No hay destinatarios para enviar', 'error'); return; }
    if (!confirm(`¿Enviar mensaje a ${lista.length} clientes por WhatsApp?`)) return;

    // Mostrar panel de progreso
    envioActivo = true;
    detenerFlag = false;
    document.getElementById('envioPreview').style.display  = 'none';
    document.getElementById('envioProgreso').classList.remove('oculto');
    document.getElementById('listaResultados').innerHTML   = '';
    document.getElementById('barraProgreso').style.width   = '0%';
    document.getElementById('progresoTexto').textContent   = 'Iniciando...';

    let enviados = 0, errores = 0;

    // ── BUCLE principal de envío ──────────────────
    for (let i = 0; i < lista.length; i++) {
        if (detenerFlag) {
            agregarResultado('⛔', 'Envío detenido manualmente', '', 'error');
            break;
        }

        const c      = lista[i];
        const tel    = limpiarTelefono(c.telefono);
        const mora   = calcularDiasMora(c.fecha_corte);
        const moraLinea = mora > 0
            ? `⚠️ *Días en mora:* ${mora} días\n`
            : '';

        // Rellenar plantilla con datos del cliente
        const mensaje = plantilla
            .replace(/{nombre}/g,      c.nombre || '')
            .replace(/{empresa}/g,     EMPRESA_NOMBRE)
            .replace(/{plan}/g,        c.plan || '')
            .replace(/{valor}/g,       Number(c.valor_mensual || 0).toLocaleString('es-CO'))
            .replace(/{fecha_corte}/g, formatFecha(c.fecha_corte))
            .replace(/{dias_mora}/g,   mora > 0 ? mora + ' días' : 'Al día')
            .replace(/{mora_linea}/g,  moraLinea);

        // Actualizar barra
        const pct = Math.round(((i + 1) / lista.length) * 100);
        document.getElementById('barraProgreso').style.width = pct + '%';
        document.getElementById('progresoTexto').textContent =
            `Enviando ${i + 1} de ${lista.length} — ${c.nombre}`;

        // Marcar como activo en la lista
        agregarResultado('⏳', c.nombre, c.telefono, 'activo', `resultado-${c.id}`);

        let ok = false;
        let razon = '';

        if (!tel) {
            razon = 'Sin teléfono válido';
        } else {
            // Abrir WhatsApp con el mensaje (modo web)
            // Cuando integres Meta API, reemplaza esta línea por la llamada al fetch
            const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
            ok = true;

            // Guardar en historial
            await client.from('facturas_enviadas').insert({
                cliente_id: c.id,
                fecha:      hoy,
                enviado:    true,
                canal:      'whatsapp'
            });
        }

        // Actualizar fila de resultado
        actualizarResultado(
            `resultado-${c.id}`,
            ok ? '✓' : '✗',
            c.nombre,
            ok ? c.telefono : razon,
            ok ? 'ok' : 'error'
        );

        if (ok) enviados++; else errores++;

        // Pausa entre mensajes para no saturar el navegador
        await sleep(800);
    }
    // ── Fin del bucle ─────────────────────────────

    envioActivo = false;
    document.getElementById('progresoTexto').textContent =
        `✓ Completado — ${enviados} enviados · ${errores} errores`;
    toast(`Envío finalizado: ${enviados} enviados`, 'exito');
}

function detenerEnvio() {
    detenerFlag = true;
    toast('Deteniendo envío...', '');
}

function agregarResultado(icono, nombre, tel, tipo, id = '') {
    const div = document.createElement('div');
    div.className = `resultado-item ${tipo}`;
    if (id) div.id = id;
    div.innerHTML = `
        <span class="resultado-icono">${icono}</span>
        <span class="resultado-nombre">${nombre}</span>
        <span class="resultado-estado">${tel}</span>`;
    document.getElementById('listaResultados').prepend(div);
}

function actualizarResultado(id, icono, nombre, estado, tipo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `resultado-item ${tipo}`;
    el.innerHTML = `
        <span class="resultado-icono">${icono}</span>
        <span class="resultado-nombre">${nombre}</span>
        <span class="resultado-estado">${estado}</span>`;
}

// ═══════════════════════════════════════
// FACTURA — generar, PDF, WhatsApp individual
// ═══════════════════════════════════════
async function generarFactura(id) {
    clienteFactura = todosClientes.find(c => c.id === id);
    if (!clienteFactura) return;

    const c     = clienteFactura;
    const valor = Number(c.valor_mensual || 0);
    const num   = 'FAC-' + String(Date.now()).slice(-6);
    const hoy   = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
    const vence = calcularVencimiento(c.fecha_corte);
    const mora  = calcularDiasMora(c.fecha_corte);

    // Verificar si ya pagó este mes
    const mes = mesActual();
    const { data: pagoData } = await client.from('pagos')
        .select('fecha_pago, valor_pagado').eq('cliente_id', id).eq('mes', mes).maybeSingle();

    const pagadoBanner = pagoData
        ? `<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#065f46;font-size:13px;font-weight:600">
               ✓ Pago registrado el ${formatFecha(pagoData.fecha_pago)} · $${Number(pagoData.valor_pagado).toLocaleString('es-CO')}
           </div>`
        : mora > 0
            ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#991b1b;font-size:13px;font-weight:600">
                   ⚠️ ${mora} días en mora
               </div>`
            : '';

    document.getElementById('previewFactura').innerHTML = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:480px;margin:0 auto">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #3b82f6">
                <div>
                    <div style="font-size:20px;font-weight:700;color:#3b82f6">⚡ ${EMPRESA_NOMBRE}</div>
                    <div style="font-size:11px;color:#666;margin-top:3px">NIT: ${EMPRESA_NIT}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:12px;font-weight:600">FACTURA</div>
                    <div style="font-size:13px;color:#3b82f6;font-weight:700">${num}</div>
                    <div style="font-size:11px;color:#666">${hoy}</div>
                </div>
            </div>
            ${pagadoBanner}
            <div style="margin-bottom:18px">
                <div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:600;margin-bottom:6px">Facturar a</div>
                <div style="font-weight:600;font-size:14px">${c.nombre}</div>
                <div style="font-size:12px;color:#444;margin-top:2px">${c.telefono}</div>
                <div style="font-size:12px;color:#444">${c.correo || ''}</div>
                <div style="font-size:12px;color:#444">${c.direccion || ''}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
                <thead>
                    <tr style="background:#f1f5f9">
                        <th style="padding:9px;text-align:left;font-size:11px;color:#64748b">DESCRIPCIÓN</th>
                        <th style="padding:9px;text-align:right;font-size:11px;color:#64748b">VALOR</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom:1px solid #e2e8f0">
                        <td style="padding:11px 9px">
                            <div style="font-weight:500;font-size:13px">${c.plan}</div>
                            <div style="font-size:11px;color:#64748b">Servicio mensual · Corte: ${formatFecha(c.fecha_corte)}</div>
                        </td>
                        <td style="padding:11px 9px;text-align:right;font-weight:600;font-size:13px">$${valor.toLocaleString('es-CO')}</td>
                    </tr>
                </tbody>
            </table>
            <div style="display:flex;justify-content:flex-end;margin-bottom:18px">
                <div style="min-width:200px">
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111">
                        <span style="font-weight:700;font-size:13px">TOTAL</span>
                        <span style="font-weight:700;font-size:15px;color:#3b82f6">$${valor.toLocaleString('es-CO')}</span>
                    </div>
                </div>
            </div>
            <div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:11px;color:#64748b">
                <strong style="color:#111">Pagar antes del:</strong> ${vence}<br>
                Consignar a nombre de <strong>${EMPRESA_NOMBRE}</strong>
            </div>
        </div>`;
    document.getElementById('modalFactura').classList.remove('oculto');
}

function cerrarModal() {
    document.getElementById('modalFactura').classList.add('oculto');
    clienteFactura = null;
}

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const c   = clienteFactura;
    const valor = Number(c.valor_mensual || 0);
    const num   = 'FAC-' + String(Date.now()).slice(-6);
    const mora  = calcularDiasMora(c.fecha_corte);

    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(EMPRESA_NOMBRE, 14, 14);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('NIT: ' + EMPRESA_NIT, 14, 22);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('FACTURA ' + num, 196, 14, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-CO'), 196, 22, { align: 'right' });

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', 14, 44);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(c.nombre, 14, 52);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(c.telefono || '', 14, 58);
    doc.text(c.correo   || '', 14, 63);
    doc.text(c.direccion|| '', 14, 68);

    if (mora > 0) {
        doc.setFillColor(254, 226, 226);
        doc.rect(14, 72, 182, 8, 'F');
        doc.setTextColor(153, 27, 27);
        doc.setFontSize(9);
        doc.text(`AVISO: ${mora} días en mora`, 18, 78);
        doc.setTextColor(30, 30, 30);
    }

    const yTabla = mora > 0 ? 86 : 78;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, yTabla, 182, 9, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('DESCRIPCIÓN', 18, yTabla + 6);
    doc.text('VALOR', 192, yTabla + 6, { align: 'right' });

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(c.plan || 'Servicio', 18, yTabla + 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Servicio mensual · Corte: ' + formatFecha(c.fecha_corte), 18, yTabla + 24);
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('$' + valor.toLocaleString('es-CO'), 192, yTabla + 18, { align: 'right' });
    doc.line(14, yTabla + 30, 196, yTabla + 30);

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('TOTAL: $' + valor.toLocaleString('es-CO'), 192, yTabla + 40, { align: 'right' });

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Pagar antes del: ' + calcularVencimiento(c.fecha_corte), 14, yTabla + 55);
    doc.text('Gracias por preferir ' + EMPRESA_NOMBRE, 14, yTabla + 60);

    doc.save('factura-' + c.nombre.replace(/\s+/g, '-').toLowerCase() + '.pdf');
    toast('PDF descargado ✓', 'exito');
}

function enviarWhatsApp() {
    if (!clienteFactura) return;
    const c     = clienteFactura;
    const valor = Number(c.valor_mensual || 0);
    const vence = calcularVencimiento(c.fecha_corte);
    const mora  = calcularDiasMora(c.fecha_corte);
    const tel   = limpiarTelefono(c.telefono);
    if (!tel) { toast('Sin teléfono registrado', 'error'); return; }

    const moraLinea = mora > 0 ? `⚠️ *Días en mora:* ${mora} días\n` : '';
    const msg = `Hola ${c.nombre} 👋\n\n*${EMPRESA_NOMBRE}* le informa que su factura está lista:\n\n📋 *Plan:* ${c.plan}\n💰 *Valor:* $${valor.toLocaleString('es-CO')}\n📅 *Corte:* ${formatFecha(c.fecha_corte)}\n${moraLinea}⏰ *Pagar antes del:* ${vence}\n\nGracias por su preferencia! 🙏`;

    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    toast('Abriendo WhatsApp...', 'exito');
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('fechaHoy').textContent = formatFecha(new Date().toISOString().split('T')[0]);
    await listarClientes();
    cargarDashboard();
});