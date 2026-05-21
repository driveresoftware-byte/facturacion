const SUPABASE_URL = "https://ugilmrripmnuwbqwlweq.supabase.co";
const SUPABASE_KEY = "sb_publishable_17XU89b3ItWFRzu5KWBOFQ_I9qHs2ne";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const EMPRESA_WHATSAPP = "573001234567";
const EMPRESA_NOMBRE   = "FacturNet Internet";
const EMPRESA_NIT      = "900.123.456-7";

// ── WHAPI CONFIG ─────────────────────────────
const WHAPI_TOKEN = "TU_TOKEN_AQUI";
const WHAPI_URL   = "https://gate.whapi.cloud/messages/text";
// ─────────────────────────────────────────────

let todosClientes  = [];
let todosPagos     = [];
let todosPlanes    = [];
let clienteFactura = null;
let envioActivo    = false;
let detenerFlag    = false;
let chartTorta     = null;
let chartPlanes    = null;
let chartCobrador  = null;

// ═══════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════
const mesActual = () => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`;
};

function formatFecha(f) {
    if (!f) return '—';
    const [y,m,d] = f.split('-');
    return `${d} ${'ene feb mar abr may jun jul ago sep oct nov dic'.split(' ')[+m-1]} ${y}`;
}

function calcularVencimiento(fc) {
    if (!fc) return '—';
    const f = new Date(fc+'T00:00:00'); f.setDate(f.getDate()+5);
    return f.toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'numeric'});
}

function calcularDiasMora(fc) {
    if (!fc) return 0;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const d   = Math.floor((hoy - new Date(fc+'T00:00:00'))/86400000);
    return d > 0 ? d : 0;
}

const limpiarTelefono = t => {
    if (!t) return '';
    const s = String(t).replace(/\D/g,'');
    return s.startsWith('57') ? s : '57'+s;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function toast(msg, tipo='') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast '+tipo;
    t.classList.remove('oculto');
    setTimeout(()=>t.classList.add('oculto'), 3200);
}

// ═══════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════
function mostrarSeccion(nombre, el) {
    document.querySelectorAll('.seccion').forEach(s=>s.classList.add('oculto'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.getElementById('sec-'+nombre).classList.remove('oculto');
    (el||event?.target?.closest('.nav-item'))?.classList.add('active');
    if (nombre==='dashboard') cargarDashboard();
    if (nombre==='clientes')  listarClientes();
    if (nombre==='planes')    cargarPlanes();
    if (nombre==='pagos')     { poblarSelectorMes('filtroPagoMes'); cargarPagos(); }
    if (nombre==='balance')   { poblarSelectorMes('filtroBalanceMes'); cargarBalance(); }
    if (nombre==='envio')     iniciarSeccionEnvio();
}

// ═══════════════════════════════════════════════
// PLANES — CRUD
// ═══════════════════════════════════════════════
async function cargarPlanes() {
    const { data, error } = await client.from('planes').select('*').order('precio');
    if (error) { console.error(error); return; }
    todosPlanes = data || [];
    renderPlanes();
    poblarSelectPlanes();
}

async function renderPlanes() {
    // Contar clientes por plan
    const conteo = {};
    todosClientes.forEach(c => { conteo[c.plan] = (conteo[c.plan]||0)+1; });

    const grid = document.getElementById('planesGrid');
    if (!todosPlanes.length) {
        grid.innerHTML = '<p style="color:var(--text2)">No hay planes creados aún.</p>'; return;
    }
    grid.innerHTML = todosPlanes.map(p => `
        <div class="plan-card ${p.activo?'':'inactivo'}">
            ${!p.activo?'<span class="plan-badge-inactivo">Inactivo</span>':''}
            <div class="plan-precio">$${Number(p.precio||0).toLocaleString('es-CO')}<span style="font-size:13px;color:var(--text2)">/mes</span></div>
            <div class="plan-nombre">${p.nombre}</div>
            ${p.velocidad?`<div class="plan-velocidad">⚡ ${p.velocidad}</div>`:''}
            ${p.descripcion?`<div class="plan-desc">${p.descripcion}</div>`:''}
            <div class="plan-clientes">👥 ${conteo[p.nombre]||0} clientes activos</div>
            <div class="plan-acciones">
                <button class="btn-accion editar" onclick="editarPlan(${p.id})">Editar</button>
                <button class="btn-accion borrar" onclick="eliminarPlan(${p.id})">Eliminar</button>
            </div>
        </div>`).join('');
}

function poblarSelectPlanes() {
    const sel = document.getElementById('planSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Seleccionar plan —</option>' +
        todosPlanes.filter(p=>p.activo).map(p =>
            `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${p.nombre}" data-vel="${p.velocidad||''}">${p.nombre} — $${Number(p.precio).toLocaleString('es-CO')}</option>`
        ).join('');
}

function seleccionarPlan() {
    const sel  = document.getElementById('planSelect');
    const opt  = sel.options[sel.selectedIndex];
    if (!opt.value) return;
    document.getElementById('plan').value          = opt.dataset.nombre;
    document.getElementById('valor').value         = opt.dataset.precio;
    document.getElementById('velocidad_plan').value= opt.dataset.vel;
}

function abrirModalPlan(id) {
    document.getElementById('planId').value      = id||'';
    document.getElementById('planNombre').value  = '';
    document.getElementById('planPrecio').value  = '';
    document.getElementById('planVelocidad').value='';
    document.getElementById('planDesc').value    = '';
    document.getElementById('planActivo').value  = 'true';
    document.getElementById('tituloPlan').textContent = id ? 'Editar Plan' : 'Nuevo Plan';
    if (id) {
        const p = todosPlanes.find(x=>x.id===id);
        if (p) {
            document.getElementById('planNombre').value   = p.nombre||'';
            document.getElementById('planPrecio').value   = p.precio||'';
            document.getElementById('planVelocidad').value= p.velocidad||'';
            document.getElementById('planDesc').value     = p.descripcion||'';
            document.getElementById('planActivo').value   = String(p.activo);
        }
    }
    document.getElementById('modalPlan').classList.remove('oculto');
}

function cerrarModalPlan() { document.getElementById('modalPlan').classList.add('oculto'); }

async function guardarPlan() {
    const id     = document.getElementById('planId').value;
    const datos  = {
        nombre:      document.getElementById('planNombre').value.trim(),
        precio:      parseFloat(document.getElementById('planPrecio').value)||0,
        velocidad:   document.getElementById('planVelocidad').value.trim(),
        descripcion: document.getElementById('planDesc').value.trim(),
        activo:      document.getElementById('planActivo').value === 'true'
    };
    if (!datos.nombre) { toast('El nombre es obligatorio','error'); return; }
    let error;
    if (id) {
        ({error} = await client.from('planes').update(datos).eq('id',id));
    } else {
        ({error} = await client.from('planes').insert([datos]));
    }
    if (error) { toast('Error guardando plan','error'); console.error(error); return; }
    toast(id?'Plan actualizado ✓':'Plan creado ✓','exito');
    cerrarModalPlan();
    await cargarPlanes();
}

function editarPlan(id) { abrirModalPlan(id); }

async function eliminarPlan(id) {
    const p = todosPlanes.find(x=>x.id===id);
    if (!confirm(`¿Eliminar el plan "${p?.nombre}"?`)) return;
    const {error} = await client.from('planes').delete().eq('id',id);
    if (error) { toast('Error eliminando','error'); return; }
    toast('Plan eliminado','exito');
    await cargarPlanes();
}

// ═══════════════════════════════════════════════
// CLIENTES — CRUD
// ═══════════════════════════════════════════════
async function guardarCliente() {
    const id = document.getElementById('editId').value;
    const datos = {
        nombre:        document.getElementById('nombre').value.trim(),
        telefono:      document.getElementById('telefono').value.trim(),
        correo:        document.getElementById('correo').value.trim(),
        direccion:     document.getElementById('direccion').value.trim(),
        plan:          document.getElementById('plan').value.trim(),
        valor_mensual: parseFloat(document.getElementById('valor').value)||0,
        fecha_inicio:  document.getElementById('fecha_inicio').value,
        fecha_corte:   document.getElementById('fecha_corte').value,
        estado:        document.getElementById('estado').value
    };
    if (!datos.nombre||!datos.telefono) { toast('Nombre y teléfono son obligatorios','error'); return; }
    let error;
    if (id) { ({error}=await client.from('clientes').update(datos).eq('id',id)); }
    else    { ({error}=await client.from('clientes').insert([datos])); }
    if (error) { toast('Error guardando cliente','error'); console.error(error); return; }
    toast(id?'Cliente actualizado ✓':'Cliente guardado ✓','exito');
    limpiarFormulario();
    await listarClientes();
    mostrarSeccion('clientes', document.querySelectorAll('.nav-item')[2]);
    cargarDashboard();
}

function editarCliente(id) {
    const c = todosClientes.find(x=>x.id===id); if(!c) return;
    document.getElementById('editId').value       = c.id;
    document.getElementById('nombre').value       = c.nombre||'';
    document.getElementById('telefono').value     = c.telefono||'';
    document.getElementById('correo').value       = c.correo||'';
    document.getElementById('direccion').value    = c.direccion||'';
    document.getElementById('plan').value         = c.plan||'';
    document.getElementById('valor').value        = c.valor_mensual||'';
    document.getElementById('fecha_inicio').value = c.fecha_inicio||'';
    document.getElementById('fecha_corte').value  = c.fecha_corte||'';
    document.getElementById('estado').value       = c.estado||'activo';
    document.getElementById('velocidad_plan').value = '';
    document.getElementById('tituloFormulario').textContent = 'Editar Cliente';
    mostrarSeccion('nuevo', document.querySelectorAll('.nav-item')[1]);
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente y todos sus registros?')) return;
    const {error} = await client.from('clientes').delete().eq('id',id);
    if (error) { toast('Error eliminando','error'); return; }
    toast('Cliente eliminado','exito');
    await listarClientes(); cargarDashboard();
}

function cancelarEdicion() { limpiarFormulario(); mostrarSeccion('clientes',document.querySelectorAll('.nav-item')[2]); }

function limpiarFormulario() {
    ['editId','nombre','telefono','correo','direccion','plan','valor','fecha_inicio','fecha_corte','velocidad_plan']
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('estado').value = 'activo';
    document.getElementById('planSelect').value = '';
    document.getElementById('tituloFormulario').textContent = 'Nuevo Cliente';
}

// ═══════════════════════════════════════════════
// LISTAR CLIENTES
// ═══════════════════════════════════════════════
async function listarClientes() {
    const {data, error} = await client.from('clientes').select('*').order('nombre');
    if (error) { console.error(error); return; }
    todosClientes = data||[];
    const mes = mesActual();
    const {data:pd} = await client.from('pagos').select('cliente_id').eq('mes',mes);
    const pagadosIds = new Set((pd||[]).map(p=>p.cliente_id));
    document.getElementById('totalClientes').textContent = todosClientes.length+' clientes';
    renderTabla(todosClientes, pagadosIds);
    return pagadosIds;
}

function renderTabla(lista, pagadosIds) {
    const tbody = document.getElementById('tablaClientes');
    if (!lista.length) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text2)">No hay clientes</td></tr>'; return; }
    tbody.innerHTML = lista.map(c => {
        const pagado  = pagadosIds?.has(c.id);
        const mora    = calcularDiasMora(c.fecha_corte);
        const moraTag = pagado ? `<span class="mora-tag ninguno">—</span>`
            : mora>30 ? `<span class="mora-tag">${mora}d</span>`
            : mora>0  ? `<span class="mora-tag leve">${mora}d</span>`
            : `<span class="mora-tag ninguno">Al día</span>`;
        const badge = pagado ? `<span class="badge badge-pagado">Pagado ✓</span>`
            : `<span class="badge badge-${c.estado}">${c.estado}</span>`;
        return `<tr>
            <td><div style="font-weight:500">${c.nombre}</div><div style="font-size:11px;color:var(--text2)">${c.telefono}</div></td>
            <td><div>${c.plan||'—'}</div></td>
            <td style="font-weight:600;color:var(--verde)">$${Number(c.valor_mensual||0).toLocaleString('es-CO')}</td>
            <td style="font-size:12px">${formatFecha(c.fecha_corte)}</td>
            <td>${moraTag}</td>
            <td>${badge}</td>
            <td><div class="acciones">
                ${pagado
                    ? `<button class="btn-accion" onclick="anularPago(${c.id})" style="border-color:var(--amarillo);color:var(--amarillo);font-size:11px">Anular</button>`
                    : `<button class="btn-accion factura" onclick="abrirModalPago(${c.id})">✓ Pago</button>`
                }
                <button class="btn-accion factura" onclick="generarFactura(${c.id})">Factura</button>
                <button class="btn-accion editar"  onclick="editarCliente(${c.id})">Editar</button>
                <button class="btn-accion borrar"  onclick="eliminarCliente(${c.id})">Borrar</button>
            </div></td>
        </tr>`;
    }).join('');
}

async function filtrarClientes() {
    const busq  = document.getElementById('busqueda').value.toLowerCase();
    const estado= document.getElementById('filtroEstado').value;
    const {data:pd} = await client.from('pagos').select('cliente_id').eq('mes',mesActual());
    const pagadosIds = new Set((pd||[]).map(p=>p.cliente_id));
    const filtrado = todosClientes.filter(c=>{
        const ok = c.nombre?.toLowerCase().includes(busq)||c.telefono?.includes(busq)||c.correo?.toLowerCase().includes(busq);
        if (!ok) return false;
        if (estado==='pagado') return pagadosIds.has(c.id);
        if (estado) return c.estado===estado;
        return true;
    });
    renderTabla(filtrado, pagadosIds);
}

// ═══════════════════════════════════════════════
// PAGOS
// ═══════════════════════════════════════════════
async function abrirModalPago(clienteId) {
    const c = todosClientes.find(x=>x.id===clienteId); if(!c) return;
    document.getElementById('pagoClienteId').value   = c.id;
    document.getElementById('pagoClienteNombre').textContent = c.nombre;
    document.getElementById('pagoValor').value       = c.valor_mensual||'';
    document.getElementById('pagoFecha').value       = new Date().toISOString().split('T')[0];
    document.getElementById('pagoCobrador').value    = '';
    document.getElementById('pagoObservacion').value = '';
    // Sugerir cobradores previos
    const {data:prev} = await client.from('pagos').select('cobrador').not('cobrador','is',null).limit(50);
    const unicos = [...new Set((prev||[]).map(p=>p.cobrador).filter(Boolean))];
    const dl = document.getElementById('listaCobradoresSuggestions');
    dl.innerHTML = unicos.map(c=>`<option value="${c}">`).join('');
    document.getElementById('modalPago').classList.remove('oculto');
}

function cerrarModalPago() { document.getElementById('modalPago').classList.add('oculto'); }

async function confirmarPago() {
    const clienteId   = parseInt(document.getElementById('pagoClienteId').value);
    const valorPagado = parseFloat(document.getElementById('pagoValor').value)||0;
    const fechaPago   = document.getElementById('pagoFecha').value;
    const cobrador    = document.getElementById('pagoCobrador').value.trim();
    const observacion = document.getElementById('pagoObservacion').value.trim();
    const mes         = mesActual();

    if (!cobrador) { toast('Ingresa el nombre del cobrador','error'); return; }

    const {error} = await client.from('pagos').upsert({
        cliente_id: clienteId, mes, fecha_pago: fechaPago,
        valor_pagado: valorPagado, cobrador, observacion
    },{onConflict:'cliente_id,mes'});

    if (error) { toast('Error registrando pago','error'); console.error(error); return; }
    const c = todosClientes.find(x=>x.id===clienteId);
    if (c?.estado==='mora') await client.from('clientes').update({estado:'activo'}).eq('id',clienteId);
    toast(`Pago de ${c?.nombre} registrado ✓`,'exito');
    cerrarModalPago();
    await listarClientes(); cargarDashboard();
}

async function anularPago(clienteId) {
    const c = todosClientes.find(x=>x.id===clienteId);
    if (!confirm(`¿Anular el pago de ${c?.nombre}?`)) return;
    const {error} = await client.from('pagos').delete().eq('cliente_id',clienteId).eq('mes',mesActual());
    if (error) { toast('Error anulando','error'); return; }
    toast('Pago anulado','exito');
    await listarClientes(); cargarDashboard();
}

function poblarSelectorMes(elId) {
    const sel = document.getElementById(elId); if(!sel) return;
    const hoy = new Date();
    sel.innerHTML = '';
    for (let i=0;i<6;i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        sel.innerHTML += `<option value="${val}" ${i===0?'selected':''}>${d.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>`;
    }
}

async function cargarPagos() {
    const mes = document.getElementById('filtroPagoMes')?.value||mesActual();
    const {data:pd} = await client.from('pagos').select('*, clientes(nombre,plan,valor_mensual,telefono,fecha_corte,estado)').eq('mes',mes);
    todosPagos = pd||[];
    const pagadosIds  = new Set(todosPagos.map(p=>p.cliente_id));
    const pendientes  = todosClientes.filter(c=>!pagadosIds.has(c.id)&&['activo','mora'].includes(c.estado));
    const recaudado   = todosPagos.reduce((s,p)=>s+Number(p.valor_pagado||0),0);

    document.getElementById('pagosCount').textContent      = todosPagos.length;
    document.getElementById('pendientesCount').textContent = pendientes.length;
    document.getElementById('recaudadoMes').textContent    = '$'+recaudado.toLocaleString('es-CO');

    const tbody = document.getElementById('tablaPagos');
    const filasPagados = todosPagos.map(p=>{
        const c = p.clientes||{};
        return `<tr>
            <td><div style="font-weight:500">${c.nombre||'—'}</div><div style="font-size:11px;color:var(--text2)">${c.telefono||''}</div></td>
            <td>${c.plan||'—'}</td>
            <td style="color:var(--verde);font-weight:600">$${Number(p.valor_pagado||0).toLocaleString('es-CO')}</td>
            <td><span class="badge badge-pagado">Pagado ✓</span></td>
            <td style="font-size:12px">${formatFecha(p.fecha_pago)}</td>
            <td><span style="font-size:13px;font-weight:500">${p.cobrador||'—'}</span></td>
            <td><span class="mora-tag ninguno">—</span></td>
            <td><button class="btn-accion" onclick="anularPago(${p.cliente_id})" style="border-color:var(--amarillo);color:var(--amarillo);font-size:11px">Anular</button></td>
        </tr>`;
    });

    const filasPend = pendientes.map(c=>{
        const mora = calcularDiasMora(c.fecha_corte);
        const mTag = mora>30?`<span class="mora-tag">${mora}d</span>`:mora>0?`<span class="mora-tag leve">${mora}d</span>`:`<span class="mora-tag ninguno">Al día</span>`;
        return `<tr>
            <td><div style="font-weight:500">${c.nombre}</div><div style="font-size:11px;color:var(--text2)">${c.telefono}</div></td>
            <td>${c.plan||'—'}</td>
            <td style="color:var(--verde);font-weight:600">$${Number(c.valor_mensual||0).toLocaleString('es-CO')}</td>
            <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
            <td style="color:var(--text2);font-size:12px">Pendiente</td>
            <td>—</td>
            <td>${mTag}</td>
            <td><button class="btn-accion factura" onclick="abrirModalPago(${c.id})">✓ Registrar</button></td>
        </tr>`;
    });

    tbody.innerHTML = filasPagados.join('')+filasPend.join('')||
        '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text2)">Sin datos</td></tr>';
}

// ═══════════════════════════════════════════════
// BALANCE + GRÁFICAS
// ═══════════════════════════════════════════════
async function cargarBalance() {
    const mes = document.getElementById('filtroBalanceMes')?.value||mesActual();

    // Pagos del mes seleccionado
    const {data:pd} = await client.from('pagos')
        .select('cliente_id, valor_pagado, cobrador, clientes(plan, valor_mensual, estado)')
        .eq('mes', mes);
    const pagos = pd||[];

    // Total facturado = suma de todos los clientes activos+mora
    const totalFacturado = todosClientes
        .filter(c=>['activo','mora'].includes(c.estado))
        .reduce((s,c)=>s+Number(c.valor_mensual||0),0);
    const totalRecaudado = pagos.reduce((s,p)=>s+Number(p.valor_pagado||0),0);
    const pendiente      = Math.max(0, totalFacturado - totalRecaudado);
    const pct            = totalFacturado>0 ? Math.round((totalRecaudado/totalFacturado)*100) : 0;

    document.getElementById('balTotal').textContent     = '$'+totalFacturado.toLocaleString('es-CO');
    document.getElementById('balRecaudado').textContent = '$'+totalRecaudado.toLocaleString('es-CO');
    document.getElementById('balPendiente').textContent = '$'+pendiente.toLocaleString('es-CO');
    document.getElementById('balPct').textContent       = pct+'%';

    // ── Gráfica torta: Pagado vs Pendiente ──────
    const ctxT = document.getElementById('chartTorta').getContext('2d');
    if (chartTorta) chartTorta.destroy();
    chartTorta = new Chart(ctxT, {
        type: 'doughnut',
        data: {
            labels: ['Recaudado','Pendiente'],
            datasets:[{
                data: [totalRecaudado, pendiente],
                backgroundColor: ['#10b981','#ef4444'],
                borderColor: ['#0f172a','#0f172a'],
                borderWidth: 3
            }]
        },
        options: {
            responsive:true, maintainAspectRatio:true,
            plugins: {
                legend: { labels:{ color:'#e8edf5', font:{family:'DM Sans'} } },
                tooltip: {
                    callbacks:{
                        label: ctx=>' $'+Number(ctx.raw).toLocaleString('es-CO')
                    }
                }
            }
        }
    });

    // ── Gráfica barras: por Plan ─────────────────
    const porPlan = {};
    pagos.forEach(p=>{
        const plan = p.clientes?.plan||'Sin plan';
        porPlan[plan] = (porPlan[plan]||0) + Number(p.valor_pagado||0);
    });
    const ctxP = document.getElementById('chartPlanes').getContext('2d');
    if (chartPlanes) chartPlanes.destroy();
    chartPlanes = new Chart(ctxP,{
        type:'bar',
        data:{
            labels: Object.keys(porPlan),
            datasets:[{
                label:'Recaudado',
                data: Object.values(porPlan),
                backgroundColor:'#3b82f6',
                borderRadius:6
            }]
        },
        options:{
            responsive:true, maintainAspectRatio:true,
            plugins:{ legend:{display:false} },
            scales:{
                x:{ ticks:{color:'#7a8ba0'}, grid:{color:'#1e2d45'} },
                y:{
                    ticks:{ color:'#7a8ba0', callback:v=>'$'+Number(v).toLocaleString('es-CO') },
                    grid:{ color:'#1e2d45' }
                }
            }
        }
    });

    // ── Gráfica barras: por Cobrador ─────────────
    const porCobrador = {};
    pagos.forEach(p=>{
        const cob = p.cobrador||'Sin asignar';
        porCobrador[cob] = (porCobrador[cob]||0) + Number(p.valor_pagado||0);
    });
    const colores = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16'];
    const ctxC = document.getElementById('chartCobrador').getContext('2d');
    if (chartCobrador) chartCobrador.destroy();
    chartCobrador = new Chart(ctxC,{
        type:'bar',
        data:{
            labels: Object.keys(porCobrador),
            datasets:[{
                label:'Recaudado',
                data: Object.values(porCobrador),
                backgroundColor: Object.keys(porCobrador).map((_,i)=>colores[i%colores.length]),
                borderRadius:6
            }]
        },
        options:{
            indexAxis:'y',
            responsive:true, maintainAspectRatio:true,
            plugins:{ legend:{display:false} },
            scales:{
                x:{
                    ticks:{ color:'#7a8ba0', callback:v=>'$'+Number(v).toLocaleString('es-CO') },
                    grid:{ color:'#1e2d45' }
                },
                y:{ ticks:{color:'#e8edf5'}, grid:{color:'#1e2d45'} }
            }
        }
    });

    // ── Tabla cobradores ─────────────────────────
    const tbody = document.getElementById('tablaCobradores');
    if (!Object.keys(porCobrador).length) {
        tbody.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text2)">Sin pagos en este mes</td></tr>';
        return;
    }
    tbody.innerHTML = Object.entries(porCobrador)
        .sort((a,b)=>b[1]-a[1])
        .map(([cob,total],i)=>{
            const cant = pagos.filter(p=>(p.cobrador||'Sin asignar')===cob).length;
            const porcentaje = totalRecaudado>0 ? Math.round((total/totalRecaudado)*100) : 0;
            return `<tr>
                <td>
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:10px;height:10px;border-radius:50%;background:${colores[i%colores.length]}"></div>
                        <span style="font-weight:500">${cob}</span>
                    </div>
                </td>
                <td>${cant} pagos</td>
                <td style="font-weight:600;color:var(--verde)">$${Number(total).toLocaleString('es-CO')}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${porcentaje}%;background:${colores[i%colores.length]};border-radius:3px"></div>
                        </div>
                        <span style="font-size:12px;color:var(--text2);width:32px">${porcentaje}%</span>
                    </div>
                </td>
            </tr>`;
        }).join('');
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
async function cargarDashboard() {
    if (!todosClientes.length) await listarClientes();
    const mes = mesActual();
    const {data:pd} = await client.from('pagos').select('cliente_id,valor_pagado').eq('mes',mes);
    const pagadosIds = new Set((pd||[]).map(p=>p.cliente_id));
    const recaudado  = (pd||[]).reduce((s,p)=>s+Number(p.valor_pagado||0),0);

    document.getElementById('statTotal').textContent     = todosClientes.length;
    document.getElementById('statActivos').textContent   = todosClientes.filter(c=>c.estado==='activo').length;
    document.getElementById('statMora').textContent      = todosClientes.filter(c=>c.estado==='mora').length;
    document.getElementById('statPagados').textContent   = pagadosIds.size;
    document.getElementById('statValor').textContent     = '$'+todosClientes.reduce((s,c)=>s+Number(c.valor_mensual||0),0).toLocaleString('es-CO');
    document.getElementById('statRecaudado').textContent = '$'+recaudado.toLocaleString('es-CO');
    document.getElementById('totalClientes').textContent = todosClientes.length+' clientes';
    document.getElementById('fechaHoy').textContent      = formatFecha(new Date().toISOString().split('T')[0]);

    const hoy = new Date().toISOString().split('T')[0];
    const cortesHoy = todosClientes.filter(c=>c.fecha_corte===hoy);
    const lista = document.getElementById('listaCortes');
    if (!cortesHoy.length) {
        lista.innerHTML='<p style="color:var(--text2);font-size:14px">No hay cortes para hoy.</p>'; return;
    }
    lista.innerHTML = cortesHoy.map(c=>{
        const pagado = pagadosIds.has(c.id);
        return `<div class="corte-item">
            <div><div class="corte-nombre">${c.nombre}</div><div class="corte-info">${c.telefono} · ${c.plan}</div></div>
            <div class="corte-valor">$${Number(c.valor_mensual).toLocaleString('es-CO')}</div>
            ${pagado
                ? `<span class="badge badge-pagado">Pagado ✓</span>`
                : `<button class="btn-accion factura" onclick="abrirModalPago(${c.id})">✓ Registrar</button>`
            }
            <button class="btn-accion factura" onclick="generarFactura(${c.id})">Factura</button>
        </div>`;
    }).join('');
}

// ═══════════════════════════════════════════════
// ENVÍO MASIVO (Whapi)
// ═══════════════════════════════════════════════
async function iniciarSeccionEnvio() {
    if (!todosClientes.length) await listarClientes();
    const radios = document.querySelectorAll('input[name="destinatarios"]');
    if (![...radios].some(r=>r.checked)) radios[0].checked=true;
    verificarTokenWhapi();
    previsualizarEnvio();
}

async function verificarTokenWhapi() {
    const badge = document.getElementById('whapiStatus');
    if (!badge) return;
    if (!WHAPI_TOKEN||WHAPI_TOKEN==='TU_TOKEN_AQUI') {
        badge.innerHTML='⚠️ Token no configurado — edita app.js';
        badge.className='whapi-badge error'; return;
    }
    badge.innerHTML='⏳ Verificando...'; badge.className='whapi-badge';
    try {
        const res = await fetch('https://gate.whapi.cloud/health',{headers:{'Authorization':`Bearer ${WHAPI_TOKEN}`}});
        if (res.ok) { badge.innerHTML='✅ Whapi conectado'; badge.className='whapi-badge ok'; }
        else        { badge.innerHTML='❌ Token inválido'; badge.className='whapi-badge error'; }
    } catch { badge.innerHTML='❌ Sin conexión a Whapi'; badge.className='whapi-badge error'; }
}

async function previsualizarEnvio() {
    const modo = document.querySelector('input[name="destinatarios"]:checked')?.value;
    if (!modo) return;
    const {data:pd} = await client.from('pagos').select('cliente_id').eq('mes',mesActual());
    const pagadosIds = new Set((pd||[]).map(p=>p.cliente_id));
    const hoy = new Date().toISOString().split('T')[0];
    let lista = [];
    if (modo==='todos')      lista=todosClientes.filter(c=>c.estado==='activo');
    if (modo==='mora')       lista=todosClientes.filter(c=>c.estado==='mora');
    if (modo==='corte_hoy')  lista=todosClientes.filter(c=>c.fecha_corte===hoy);
    if (modo==='sin_pagar')  lista=todosClientes.filter(c=>['activo','mora'].includes(c.estado)&&!pagadosIds.has(c.id));
    document.getElementById('previewCount').textContent = lista.length;
    document.getElementById('envioPreview').style.display = lista.length?'block':'none';
    document.getElementById('listaPreview').innerHTML = lista.slice(0,50).map((c,i)=>{
        const mora = calcularDiasMora(c.fecha_corte);
        return `<div class="preview-item">
            <div class="preview-num">${i+1}</div>
            <div class="preview-info">
                <div class="preview-nombre">${c.nombre} ${mora>0?`<span class="mora-tag leve" style="margin-left:5px">${mora}d</span>`:''}</div>
                <div class="preview-tel">${c.telefono}</div>
            </div>
            <div class="preview-valor">$${Number(c.valor_mensual||0).toLocaleString('es-CO')}</div>
        </div>`;
    }).join('')+(lista.length>50?`<div style="text-align:center;padding:10px;color:var(--text2);font-size:12px">... y ${lista.length-50} más</div>`:'');
}

async function iniciarEnvioMasivo() {
    if (envioActivo) return;
    const modo      = document.querySelector('input[name="destinatarios"]:checked')?.value;
    const plantilla = document.getElementById('plantillaMensaje').value;
    if (!modo||!plantilla.trim()) { toast('Selecciona destinatarios y escribe un mensaje','error'); return; }
    if (!WHAPI_TOKEN||WHAPI_TOKEN==='TU_TOKEN_AQUI') { toast('⚠️ Configura tu WHAPI_TOKEN en app.js','error'); return; }

    const {data:pd} = await client.from('pagos').select('cliente_id').eq('mes',mesActual());
    const pagadosIds = new Set((pd||[]).map(p=>p.cliente_id));
    const hoy = new Date().toISOString().split('T')[0];
    let lista = [];
    if (modo==='todos')      lista=todosClientes.filter(c=>c.estado==='activo');
    if (modo==='mora')       lista=todosClientes.filter(c=>c.estado==='mora');
    if (modo==='corte_hoy')  lista=todosClientes.filter(c=>c.fecha_corte===hoy);
    if (modo==='sin_pagar')  lista=todosClientes.filter(c=>['activo','mora'].includes(c.estado)&&!pagadosIds.has(c.id));

    if (!lista.length) { toast('No hay destinatarios','error'); return; }
    if (!confirm(`¿Enviar mensaje a ${lista.length} clientes?`)) return;

    envioActivo=true; detenerFlag=false;
    document.getElementById('envioPreview').style.display='none';
    document.getElementById('envioProgreso').classList.remove('oculto');
    document.getElementById('listaResultados').innerHTML='';
    document.getElementById('barraProgreso').style.width='0%';

    let enviados=0, errores=0;

    for (let i=0; i<lista.length; i++) {
        if (detenerFlag) { agregarResultado('⛔','Envío detenido','','error'); break; }
        const c   = lista[i];
        const tel = limpiarTelefono(c.telefono);
        const mora = calcularDiasMora(c.fecha_corte);
        const msg  = plantilla
            .replace(/{nombre}/g,     c.nombre||'')
            .replace(/{empresa}/g,    EMPRESA_NOMBRE)
            .replace(/{plan}/g,       c.plan||'')
            .replace(/{valor}/g,      Number(c.valor_mensual||0).toLocaleString('es-CO'))
            .replace(/{fecha_corte}/g,formatFecha(c.fecha_corte))
            .replace(/{dias_mora}/g,  mora>0?mora+' días':'Al día')
            .replace(/{mora_linea}/g, mora>0?`⚠️ *Días en mora:* ${mora} días\n`:'');

        document.getElementById('barraProgreso').style.width = Math.round(((i+1)/lista.length)*100)+'%';
        document.getElementById('progresoTexto').textContent = `Enviando ${i+1} de ${lista.length} — ${c.nombre}`;
        agregarResultado('⏳',c.nombre,c.telefono,'activo',`res-${c.id}`);

        let ok=false, razon='';
        if (!tel) { razon='Sin teléfono válido'; }
        else {
            try {
                const res = await fetch(WHAPI_URL,{
                    method:'POST',
                    headers:{'Content-Type':'application/json','Authorization':`Bearer ${WHAPI_TOKEN}`},
                    body: JSON.stringify({to:tel, body:msg})
                });
                const json = await res.json();
                ok = res.ok && !!(json.sent||json.message?.id||json.id);
                if (!ok) razon = json?.error?.message||json?.message||`HTTP ${res.status}`;
            } catch(e) { razon='Error de red: '+e.message; }
            await client.from('facturas_enviadas').insert({cliente_id:c.id,fecha:hoy,enviado:ok,canal:'whatsapp',detalle:ok?null:razon});
        }

        actualizarResultado(`res-${c.id}`, ok?'✓':'✗', c.nombre, ok?`Enviado · ${c.telefono}`:`Error: ${razon}`, ok?'ok':'error');
        if (ok) enviados++; else errores++;
        await sleep(1500);
    }

    envioActivo=false;
    document.getElementById('progresoTexto').textContent=`✓ Completado — ${enviados} enviados · ${errores} errores`;
    toast(`Envío finalizado: ${enviados} enviados`,'exito');
}

function detenerEnvio() { detenerFlag=true; toast('Deteniendo envío...'); }

function agregarResultado(ico,nombre,tel,tipo,id='') {
    const d=document.createElement('div'); d.className=`resultado-item ${tipo}`; if(id)d.id=id;
    d.innerHTML=`<span class="resultado-icono">${ico}</span><span class="resultado-nombre">${nombre}</span><span class="resultado-estado">${tel}</span>`;
    document.getElementById('listaResultados').prepend(d);
}
function actualizarResultado(id,ico,nombre,estado,tipo) {
    const el=document.getElementById(id); if(!el)return;
    el.className=`resultado-item ${tipo}`;
    el.innerHTML=`<span class="resultado-icono">${ico}</span><span class="resultado-nombre">${nombre}</span><span class="resultado-estado">${estado}</span>`;
}

// ═══════════════════════════════════════════════
// FACTURA — generar, PDF, WhatsApp individual
// ═══════════════════════════════════════════════
async function generarFactura(id) {
    clienteFactura = todosClientes.find(c=>c.id===id); if(!clienteFactura) return;
    const c=clienteFactura, valor=Number(c.valor_mensual||0);
    const num='FAC-'+String(Date.now()).slice(-6);
    const hoy=new Date().toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'numeric'});
    const mora=calcularDiasMora(c.fecha_corte);
    const {data:pd}=await client.from('pagos').select('fecha_pago,valor_pagado,cobrador').eq('cliente_id',id).eq('mes',mesActual()).maybeSingle();
    const pagadoBanner = pd
        ? `<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#065f46;font-size:13px;font-weight:600">✓ Pago registrado el ${formatFecha(pd.fecha_pago)} · $${Number(pd.valor_pagado).toLocaleString('es-CO')} · Cobrador: ${pd.cobrador||'—'}</div>`
        : mora>0 ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#991b1b;font-size:13px;font-weight:600">⚠️ ${mora} días en mora</div>` : '';

    document.getElementById('previewFactura').innerHTML=`
        <div style="font-family:Arial,sans-serif;color:#111;max-width:480px;margin:0 auto">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #3b82f6">
                <div><div style="font-size:20px;font-weight:700;color:#3b82f6">⚡ ${EMPRESA_NOMBRE}</div><div style="font-size:11px;color:#666;margin-top:3px">NIT: ${EMPRESA_NIT}</div></div>
                <div style="text-align:right"><div style="font-size:12px;font-weight:600">FACTURA</div><div style="font-size:13px;color:#3b82f6;font-weight:700">${num}</div><div style="font-size:11px;color:#666">${hoy}</div></div>
            </div>
            ${pagadoBanner}
            <div style="margin-bottom:18px">
                <div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:600;margin-bottom:6px">Facturar a</div>
                <div style="font-weight:600;font-size:14px">${c.nombre}</div>
                <div style="font-size:12px;color:#444;margin-top:2px">${c.telefono}</div>
                <div style="font-size:12px;color:#444">${c.correo||''}</div>
                <div style="font-size:12px;color:#444">${c.direccion||''}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
                <thead><tr style="background:#f1f5f9"><th style="padding:9px;text-align:left;font-size:11px;color:#64748b">DESCRIPCIÓN</th><th style="padding:9px;text-align:right;font-size:11px;color:#64748b">VALOR</th></tr></thead>
                <tbody><tr style="border-bottom:1px solid #e2e8f0">
                    <td style="padding:11px 9px"><div style="font-weight:500;font-size:13px">${c.plan}</div><div style="font-size:11px;color:#64748b">Servicio mensual · Corte: ${formatFecha(c.fecha_corte)}</div></td>
                    <td style="padding:11px 9px;text-align:right;font-weight:600;font-size:13px">$${valor.toLocaleString('es-CO')}</td>
                </tr></tbody>
            </table>
            <div style="display:flex;justify-content:flex-end;margin-bottom:18px">
                <div style="min-width:200px"><div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111"><span style="font-weight:700;font-size:13px">TOTAL</span><span style="font-weight:700;font-size:15px;color:#3b82f6">$${valor.toLocaleString('es-CO')}</span></div></div>
            </div>
            <div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:11px;color:#64748b">
                <strong style="color:#111">Pagar antes del:</strong> ${calcularVencimiento(c.fecha_corte)}<br>
                Consignar a nombre de <strong>${EMPRESA_NOMBRE}</strong>
            </div>
        </div>`;
    document.getElementById('modalFactura').classList.remove('oculto');
}

function cerrarModal() { document.getElementById('modalFactura').classList.add('oculto'); clienteFactura=null; }

function descargarPDF() {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const c=clienteFactura, valor=Number(c.valor_mensual||0);
    const num='FAC-'+String(Date.now()).slice(-6);
    const mora=calcularDiasMora(c.fecha_corte);
    doc.setFillColor(59,130,246); doc.rect(0,0,210,30,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text(EMPRESA_NOMBRE,14,14); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('NIT: '+EMPRESA_NIT,14,22); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('FACTURA '+num,196,14,{align:'right'}); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(new Date().toLocaleDateString('es-CO'),196,22,{align:'right'});
    doc.setTextColor(30,30,30); doc.setFontSize(12); doc.setFont('helvetica','bold');
    doc.text(c.nombre,14,44); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(c.telefono||'',14,50); doc.text(c.correo||'',14,55); doc.text(c.direccion||'',14,60);
    const yT=mora>0?74:66;
    if(mora>0){ doc.setFillColor(254,226,226); doc.rect(14,66,182,8,'F'); doc.setTextColor(153,27,27); doc.setFontSize(9); doc.text(`AVISO: ${mora} días en mora`,18,72); doc.setTextColor(30,30,30); }
    doc.setFillColor(241,245,249); doc.rect(14,yT,182,9,'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
    doc.text('DESCRIPCIÓN',18,yT+6); doc.text('VALOR',192,yT+6,{align:'right'});
    doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(c.plan||'Servicio',18,yT+18); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100,116,139);
    doc.text('Servicio mensual · Corte: '+formatFecha(c.fecha_corte),18,yT+24);
    doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('$'+valor.toLocaleString('es-CO'),192,yT+18,{align:'right'});
    doc.line(14,yT+30,196,yT+30);
    doc.setFontSize(12); doc.setTextColor(59,130,246);
    doc.text('TOTAL: $'+valor.toLocaleString('es-CO'),192,yT+40,{align:'right'});
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text('Pagar antes del: '+calcularVencimiento(c.fecha_corte),14,yT+55);
    doc.save('factura-'+c.nombre.replace(/\s+/g,'-').toLowerCase()+'.pdf');
    toast('PDF descargado ✓','exito');
}

function enviarWhatsApp() {
    if (!clienteFactura) return;
    const c=clienteFactura, valor=Number(c.valor_mensual||0);
    const mora=calcularDiasMora(c.fecha_corte), tel=limpiarTelefono(c.telefono);
    if (!tel) { toast('Sin teléfono registrado','error'); return; }
    const msg=`Hola ${c.nombre} 👋\n\n*${EMPRESA_NOMBRE}* le informa que su factura está lista:\n\n📋 *Plan:* ${c.plan}\n💰 *Valor:* $${valor.toLocaleString('es-CO')}\n📅 *Corte:* ${formatFecha(c.fecha_corte)}\n${mora>0?`⚠️ *Mora:* ${mora} días\n`:''}\n⏰ *Pagar antes del:* ${calcularVencimiento(c.fecha_corte)}\n\n¡Gracias por su preferencia! 🙏`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,'_blank');
    toast('Abriendo WhatsApp...','exito');
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('fechaHoy').textContent = formatFecha(new Date().toISOString().split('T')[0]);
    await listarClientes();
    await cargarPlanes();
    cargarDashboard();
});