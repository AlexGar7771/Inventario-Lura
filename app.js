const supabaseUrl = 'https://cdblyqtxpuxnhwbxykfh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkYmx5cXR4cHV4bmh3Ynh5a2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDgxMjksImV4cCI6MjA5OTc4NDEyOX0.XMozUuwLYLz3vB8UokwLNX-E-wJZr4QdVnkcVynvnjk';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let insumosGlobal = [], proveedoresGlobal = [], asignacionesGlobal = [], platillosGlobal = [], recetasGlobal = []; 
let platilloActivoID = null; 
let carritoIngredientes = [];

async function cargarDatosMaestros() {
    try {
        const [resInsumos, resProv, resAsig, resPlatillos, resRecetas] = await Promise.all([
            db.from('insumos').select('*').order('id', { ascending: true }),
            db.from('proveedores').select('*').order('id', { ascending: true }),
            db.from('proveedor_insumo').select('id, id_proveedor, id_insumo, precio'),
            db.from('platillos').select('*').order('nombre', { ascending: true }),
            db.from('platillo_insumo').select('*')
        ]);

        if (resInsumos.error || resProv.error || resPlatillos.error || resRecetas.error) {
            alert("⚠️ ERROR BD. Verifica tu conexión a Supabase."); return;
        }

        insumosGlobal = resInsumos.data || [];
        insumosGlobal.forEach(i => { if(!i.categoria) i.categoria = 'bodega'; });
        proveedoresGlobal = resProv.data || [];
        asignacionesGlobal = resAsig.data || [];
        platillosGlobal = resPlatillos.data || [];
        recetasGlobal = resRecetas.data || [];

        // Migración automática de precios (rescatamos precios de los proveedores a los insumos si están en Q0)
        let promesasMigracion = [];
        insumosGlobal.forEach(ins => {
            if (!ins.precio_compra || parseFloat(ins.precio_compra) === 0) {
                const asig = asignacionesGlobal.find(a => a.id_insumo == ins.id && parseFloat(a.precio) > 0);
                if (asig) {
                    ins.precio_compra = asig.precio; ins.cantidad_compra = 1;
                    promesasMigracion.push(db.from('insumos').update({precio_compra: asig.precio, cantidad_compra: 1}).eq('id', ins.id));
                }
            }
        });
        if (promesasMigracion.length > 0) Promise.all(promesasMigracion).catch(e => console.error(e));

        ['buscador-insumos', 'buscador-entrada', 'buscador-salida', 'buscador-pedido', 'buscador-directorio'].forEach(id => {
            let el = document.getElementById(id); if(el) el.value = "";
        });

        renderizarDashboard();
        renderizarInsumos(); 
        renderizarDirectorioPrecios(); 
        renderizarCatalogoPlatillos(); 
        llenarSelectInsumosReceta(); 
        renderizarProveedores(); 
        renderizarCatalogoProveedores();
        
        const selProd = document.getElementById('select-platillo-produccion');
        if(selProd) {
            selProd.innerHTML = '<option value="">¿Qué platillo se preparó?</option>';
            platillosGlobal.forEach(p => { selProd.innerHTML += `<option value="${p.id}">${p.nombre}</option>`; });
        }
        
        generarListaInteractiva('todos', 'lista-entrada-dinamica', 'entrada', '');
        
        if(document.getElementById('select-prov-entrada')) document.getElementById('select-prov-entrada').dispatchEvent(new Event('change'));
        if(document.getElementById('select-prov-salida')) document.getElementById('select-prov-salida').dispatchEvent(new Event('change'));
        if(document.getElementById('select-prov-pedido')) document.getElementById('select-prov-pedido').dispatchEvent(new Event('change'));
        if(document.getElementById('select-prov-asignar')) document.getElementById('select-prov-asignar').dispatchEvent(new Event('change'));

    } catch (error) { console.error("Error:", error.message); }
}

function renderizarDashboard() {
    let valorTotal = 0;
    let alertas = 0;
    let htmlAlertas = '';

    insumosGlobal.forEach(ins => {
        const stock = parseFloat(ins.cantidad_actual) || 0;
        const min = parseFloat(ins.stock_minimo) || 0;
        const pUnit = (parseFloat(ins.precio_compra) || 0) / (parseFloat(ins.cantidad_compra) || 1);
        
        if (stock > 0) valorTotal += (stock * pUnit);
        if (stock <= min && ins.categoria !== 'subreceta') {
            alertas++;
            htmlAlertas += `<div style="background:#fee2e2; border:1px solid #fca5a5; padding:10px; border-radius:5px; display:flex; justify-content:space-between;"><strong>${ins.nombre}</strong><span style="color:#b91c1c;">Quedan: ${stock} ${ins.unidad_medida}</span></div>`;
        }
    });

    const dBodega = document.getElementById('dash-valor-bodega');
    if(dBodega) dBodega.innerText = `Q${valorTotal.toFixed(2)}`;
    
    const dProds = document.getElementById('dash-total-productos');
    if(dProds) dProds.innerText = insumosGlobal.length;
    
    const dAlertas = document.getElementById('dash-alertas');
    if(dAlertas) dAlertas.innerText = alertas;
    
    const dRecetas = document.getElementById('dash-recetas');
    if(dRecetas) dRecetas.innerText = platillosGlobal.length;
    
    const dList = document.getElementById('dash-lista-alertas');
    if(dList) dList.innerHTML = htmlAlertas || '<p style="color:green; font-weight:bold;">Todo en orden. No hay escasez en bodega.</p>';
}

function obtenerEquivalencia(uCompra, uReceta) {
    if (!uCompra || !uReceta) return 1;
    const uc = uCompra.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const ur = uReceta.toLowerCase();

    let tipoCompra = 'unidad';
    if (uc.includes('lb') || uc.includes('libra')) tipoCompra = 'lb';
    else if (uc.includes('kg') || uc.includes('kilo')) tipoCompra = 'kg';
    else if (uc.includes('g') || uc === 'gr' || uc.includes('gramo')) tipoCompra = 'g';
    else if (uc.includes('oz') || uc.includes('onza')) tipoCompra = 'oz';
    else if (uc === 'l' || uc.includes('litro') || uc === 'lt') tipoCompra = 'l';
    else if (uc.includes('ml') || uc.includes('mili')) tipoCompra = 'ml';
    else if (uc.includes('gal')) tipoCompra = 'gal';
    else if (uc.includes('caja')) tipoCompra = 'unidad'; 
    else if (uc.includes('porcion') || uc.includes('porción')) tipoCompra = 'porcion';

    const cv = {
        'lb': { 'g': 453.592, 'kg': 0.453592, 'oz': 16, 'lb': 1 },
        'kg': { 'g': 1000, 'kg': 1, 'oz': 35.274, 'lb': 2.20462 },
        'g':  { 'g': 1, 'kg': 0.001, 'oz': 0.035274, 'lb': 0.00220462 },
        'oz': { 'g': 28.3495, 'kg': 0.0283495, 'oz': 1, 'lb': 0.0625, 'ml': 29.5735 },
        'l':  { 'ml': 1000, 'l': 1, 'oz': 33.814 },
        'ml': { 'ml': 1, 'l': 0.001, 'oz': 0.033814 },
        'gal':{ 'ml': 3785.41, 'l': 3.78541, 'oz': 128 },
        'unidad': { 'unidad': 1 },
        'porcion': { 'porcion': 1, 'unidad': 1 }
    };
    return (cv[tipoCompra] && cv[tipoCompra][ur]) ? cv[tipoCompra][ur] : 1; 
}

function calcularEnVivo() {
    const idIns = document.getElementById('select-insumo-receta').value;
    const insumo = insumosGlobal.find(i => i.id == idIns);
    const panel = document.getElementById('panel-matematica');

    if (!insumo) { panel.innerHTML = "Selecciona un ingrediente para ver el costo."; panel.style.color = "#4b5563"; return; }

    const cCmp = parseFloat(insumo.cantidad_compra) || 1;
    const pCmp = parseFloat(insumo.precio_compra) || 0;
    const uCmp = insumo.unidad_medida;
    const cRec = parseFloat(document.getElementById('receta-cantidad').value) || 0;
    const uRec = document.getElementById('receta-unidad').value;

    if (pCmp <= 0) { panel.innerHTML = `⚠️️ ¡El producto NO tiene precio en inventario!`; panel.style.color = "#b91c1c"; return; }
    if (cRec <= 0) { panel.innerHTML = "Escribe cuánto lleva la receta."; panel.style.color = "#4b5563"; return; }

    const eq = obtenerEquivalencia(uCmp, uRec);
    const costoT = ((pCmp / cCmp) / eq) * cRec;
    
    let subrecetaTag = insumo.categoria === 'subreceta' ? " <span style='color:blue;'>(Sub-receta)</span>" : "";

    panel.innerHTML = `<strong>Automático${subrecetaTag}:</strong> 1 ${uCmp} trae ${eq} ${uRec}. Usar ${cRec} ${uRec} cuesta: <strong style="color:red; font-size:1.2em;">Q${costoT.toFixed(2)}</strong>.`;
    panel.style.color = "#065f46";
}

function renderizarInsumos(filtro = '') {
    const tbody = document.getElementById('tabla-insumos-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    const txt = filtro.toLowerCase();

    insumosGlobal.forEach(ins => {
        if (!ins.nombre.toLowerCase().includes(txt) && !(ins.codigo && ins.codigo.toLowerCase().includes(txt))) return;
        const color = parseFloat(ins.cantidad_actual) <= parseFloat(ins.stock_minimo) ? 'color:red;' : 'color:green;';
        let nomMostrar = ins.nombre;
        if (ins.categoria === 'subreceta') nomMostrar += ` <span style="background:#dbeafe; color:#1e40af; font-size:0.7em; padding:2px 5px; border-radius:3px;">Sub-Receta</span>`;
        
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #ccc;">
                <td style="padding:10px;">${ins.codigo || '---'}</td>
                <td style="padding:10px;">${nomMostrar}</td>
                <td style="padding:10px; text-align:center;"><span style="${color} font-weight:bold;">${ins.cantidad_actual} ${ins.unidad_medida}</span></td>
                <td style="padding:10px; text-align:center;">
                    <button class="btn btn-editar-insumo" data-id="${ins.id}" style="background:var(--naranja); color:white; padding:5px 10px; border-radius:3px; border:none; cursor:pointer;">Editar</button>
                    <button class="btn btn-peligro btn-eliminar" data-id="${ins.id}" style="padding:5px 10px; border-radius:3px; border:none; cursor:pointer;">Borrar</button>
                </td>
            </tr>
        `;
    });
}

function renderizarDirectorioPrecios(filtro = '') {
    const tbody = document.getElementById('tabla-directorio-precios');
    if(!tbody) return;
    tbody.innerHTML = '';
    const txt = filtro.toLowerCase();

    insumosGlobal.forEach(ins => {
        if(!ins.nombre.toLowerCase().includes(txt) && !(ins.codigo && ins.codigo.toLowerCase().includes(txt))) return;
        const asig = asignacionesGlobal.find(a => a.id_insumo == ins.id);
        const prov = asig ? proveedoresGlobal.find(p => p.id == asig.id_proveedor) : null;
        
        let pNom = prov ? prov.nombre : '<span style="color:gray; font-size:0.85em;">Sin Proveedor</span>';
        if (ins.categoria === 'subreceta') pNom = '<span style="color:#0284c7; font-weight:bold; font-size:0.85em;">Producción Interna</span>';

        const cBase = (ins.precio_compra || 0) / (ins.cantidad_compra || 1);
        const hPr = (ins.precio_compra || 0) > 0 ? `Q${parseFloat(ins.precio_compra).toFixed(2)}` : `<span style="color:red; font-weight:bold;">⚠️ Fija el precio en Inventario</span>`;

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding:10px;">${ins.codigo ? `[${ins.codigo}] ` : ''}${ins.nombre}</td>
                <td style="padding:10px;">${pNom}</td>
                <td style="padding:10px; text-align:center;">${ins.cantidad_compra || 1} ${ins.unidad_medida}</td>
                <td style="padding:10px; text-align:right; font-weight:bold; color:green;">${hPr}</td>
                <td style="padding:10px; text-align:right; color:gray;">Q${cBase.toFixed(2)} / ${ins.unidad_medida}</td>
            </tr>
        `;
    });
}

// === RESTAURANDO FUNCIONES DE PROVEEDORES ===
function renderizarProveedores() {
    const selects = ['select-prov-asignar', 'select-prov-entrada', 'select-prov-pedido', 'insumo-prov-rapido'];
    selects.forEach(id => {
        const sel = document.getElementById(id); if(!sel) return;
        sel.innerHTML = `<option value="">Seleccione Proveedor...</option>`;
        if (id === 'select-prov-entrada') sel.innerHTML += '<option value="todos">Mostrar TODOS</option>';
        proveedoresGlobal.forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`; });
    });
    
    const selSalida = document.getElementById('select-prov-salida');
    if(selSalida) {
        selSalida.innerHTML = '<option value="todos">Mostrar TODOS</option>';
        proveedoresGlobal.forEach(p => { selSalida.innerHTML += `<option value="${p.id}">Filtrar por: ${p.nombre}</option>`; });
    }
}

function renderizarCatalogoProveedores() {
    const cnt = document.getElementById('contenedor-catalogo-proveedores');
    if(!cnt) return; 
    cnt.innerHTML = '';

    proveedoresGlobal.forEach(prov => {
        const asigs = asignacionesGlobal.filter(a => a.id_proveedor == prov.id);
        let htmlProductos = '';
        
        if (asigs.length === 0) {
            htmlProductos = '<p style="color:gray;">No tiene productos vinculados.</p>';
        } else {
            htmlProductos = '<ul style="list-style:none; padding:0; margin-top: 10px;">';
            asigs.forEach(asig => {
                const ins = insumosGlobal.find(i => i.id == asig.id_insumo);
                if (ins) {
                    const precioMostrar = parseFloat(asig.precio || ins.precio_compra || 0).toFixed(2);
                    htmlProductos += `
                        <li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                            <span>📦 ${ins.nombre} - <strong style="color:green;">Q${precioMostrar}</strong></span>
                            <div>
                                <button class="btn btn-editar-precio" data-id="${asig.id}" data-precio="${precioMostrar}" style="background:var(--naranja); color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;">Editar Precio</button>
                                <button class="btn btn-peligro btn-quitar-asignacion" data-id="${asig.id}" style="padding:4px 8px; border:none; border-radius:3px; cursor:pointer;">Quitar</button>
                            </div>
                        </li>
                    `;
                }
            });
            htmlProductos += '</ul>';
        }

        cnt.innerHTML += `
            <div style="border:1px solid var(--borde); padding:15px; margin-bottom:15px; border-radius:5px; background:#f9fafb;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div>
                        <h4 style="margin:0; color:var(--azul); font-size:1.2rem;">${prov.nombre}</h4>
                        <span style="display:inline-block; margin-top:5px; background:#e5e7eb; padding:3px 8px; border-radius:4px; font-weight:bold;">Tel: ${prov.telefono}</span>
                    </div>
                    <div>
                        <button class="btn btn-editar-prov" data-id="${prov.id}" style="background:var(--naranja); color:white; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Editar</button>
                        <button class="btn btn-peligro btn-eliminar-prov" data-id="${prov.id}" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Borrar</button>
                    </div>
                </div>
                ${htmlProductos}
            </div>
        `;
    });
}

// === CREADOR DE RECETAS ===
window.llenarSelectInsumosReceta = function(filtro = '') {
    const sel = document.getElementById('select-insumo-receta');
    if(!sel) return;
    const v = sel.value;
    sel.innerHTML = '<option value="">Seleccione Insumo o Sub-receta...</option>';
    insumosGlobal.forEach(i => {
        if(i.nombre.toLowerCase().includes(filtro.toLowerCase())) {
            const w = (!i.precio_compra || parseFloat(i.precio_compra) === 0) ? " ⚠️ (FALTA PRECIO)" : "";
            const sub = i.categoria === 'subreceta' ? " (Sub-receta)" : "";
            sel.innerHTML += `<option value="${i.id}">${i.nombre}${sub}${w}</option>`;
        }
    });
    if(v) sel.value = v;
}

function renderTablaCarrito() {
    const tbody = document.getElementById('tabla-carrito-receta');
    if(!tbody) return;
    if(carritoIngredientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:gray;">Agrega ingredientes.</td></tr>'; return;
    }
    let html = '', cTot = 0;
    carritoIngredientes.forEach(ing => {
        cTot += ing.costo_calculado;
        html += `<tr><td style="padding:10px; border-bottom:1px solid #eee;">${ing.nombre_insumo}</td><td style="padding:10px; text-align:center;"><b>${ing.cantidad_usada}</b> ${ing.unidad_receta}</td><td style="padding:10px; text-align:right; font-weight:bold;">Q${ing.costo_calculado.toFixed(2)}</td><td style="padding:10px; text-align:center;"><button type="button" class="btn btn-peligro" onclick="quitarDelCarrito(${ing.temp_id})" style="padding:2px 6px;">X</button></td></tr>`;
    });
    html += `<tr style="background:#fef3c7;"><td colspan="2" style="text-align:right; font-weight:bold; padding:10px;">Subtotal MP:</td><td style="text-align:right; font-weight:bold; color:red; padding:10px;">Q${cTot.toFixed(2)}</td><td></td></tr>`;
    tbody.innerHTML = html;
}

window.quitarDelCarrito = function(id) { carritoIngredientes = carritoIngredientes.filter(i => i.temp_id !== id); renderTablaCarrito(); }

function calcularCostoPlatilloReal(idPlatillo) {
    const platillo = platillosGlobal.find(p => p.id == idPlatillo);
    if(!platillo) return { mp: 0, total: 0, porcion: 0 };
    const ingrs = recetasGlobal.filter(r => r.id_platillo == idPlatillo);
    let cMp = 0;
    ingrs.forEach(ing => {
        const ins = insumosGlobal.find(i => i.id == ing.id_insumo);
        if(ins) {
            const eq = obtenerEquivalencia(ins.unidad_medida, ing.unidad_receta);
            cMp += (((parseFloat(ins.precio_compra) || 0) / (parseFloat(ins.cantidad_compra) || 1)) / eq) * parseFloat(ing.cantidad_usada);
        }
    });
    const cTot = cMp + (cMp * ((platillo.margen_error || 0) / 100));
    return { mp: cMp, total: cTot, porcion: cTot / (platillo.porciones || 1) };
}

function renderizarCatalogoPlatillos() {
    const cnt = document.getElementById('contenedor-tarjetas-platillos');
    if(!cnt) return;
    cnt.innerHTML = '';
    platillosGlobal.forEach(platillo => {
        const costos = calcularCostoPlatilloReal(platillo.id);
        
        cnt.innerHTML += `
            <div style="background:white; border:1px solid #ddd; border-radius:8px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h4 style="color:var(--azul); margin:0 0 5px 0;">${platillo.nombre}</h4>
                <p style="margin:0; font-size:0.85em; color:gray;">Rinde: ${platillo.porciones} porción(es)</p>
                <p style="margin:10px 0; font-size:1.1em; font-weight:bold; color:red;">Costo Unit: Q${costos.porcion.toFixed(2)}</p>
                <div style="display:flex; gap:5px; margin-top:15px;">
                    <button class="btn btn-primario btn-imprimir-ficha" data-id="${platillo.id}" style="padding:8px;" title="Imprimir PDF">🖨️</button>
                    <button class="btn btn-editar btn-abrir-ficha" data-id="${platillo.id}" style="flex:1; padding:8px;">📝 Editar</button>
                    <button class="btn btn-peligro btn-eliminar-platillo" data-id="${platillo.id}" style="padding:8px;">🗑</button>
                </div>
            </div>`;
    });
}

function cargarRecetaParaEditar(id) {
    const platillo = platillosGlobal.find(p => p.id == id);
    if(!platillo) return;
    document.getElementById('platillo-id').value = platillo.id;
    document.getElementById('platillo-nombre').value = platillo.nombre;
    document.getElementById('platillo-categoria').value = platillo.categoria || '';
    document.getElementById('platillo-porciones').value = platillo.porciones || 1;
    document.getElementById('platillo-margen').value = platillo.margen_error || 10;
    document.getElementById('platillo-porcentaje').value = platillo.porcentaje_costo_establecido || 30;
    document.getElementById('titulo-form-platillo').innerText = "Editando: " + platillo.nombre;
    document.getElementById('btn-guardar-maestro').innerText = "💾 ACTUALIZAR RECETA";
    document.getElementById('btn-guardar-maestro').classList.replace('btn-primario', 'btn-editar');
    document.getElementById('btn-cancelar-maestro').classList.remove('oculto');

    carritoIngredientes = [];
    recetasGlobal.filter(r => r.id_platillo == id).forEach(ing => {
        const ins = insumosGlobal.find(i => i.id == ing.id_insumo);
        if (ins) {
            const eq = obtenerEquivalencia(ins.unidad_medida, ing.unidad_receta);
            const cCalc = (((parseFloat(ins.precio_compra)||0) / (parseFloat(ins.cantidad_compra)||1)) / eq) * parseFloat(ing.cantidad_usada);
            carritoIngredientes.push({ temp_id: Date.now()+Math.random(), id_insumo: ing.id_insumo, nombre_insumo: ins.nombre, cantidad_usada: parseFloat(ing.cantidad_usada), unidad_receta: ing.unidad_receta, costo_calculado: cCalc });
        }
    });
    renderTablaCarrito();
}

window.cancelarEdicionMaestro = function() {
    document.getElementById('form-maestro-receta').reset();
    document.getElementById('platillo-id').value = "";
    document.getElementById('titulo-form-platillo').innerText = "Armar Nueva Receta";
    document.getElementById('btn-guardar-maestro').innerText = "💾 GUARDAR RECETA COMPLETA";
    document.getElementById('btn-guardar-maestro').classList.replace('btn-editar', 'btn-primario');
    document.getElementById('btn-cancelar-maestro').classList.add('oculto');
    const opcSub = document.getElementById('opciones-subreceta');
    if (opcSub) opcSub.style.display = 'none';
    carritoIngredientes = []; renderTablaCarrito();
}

// === MANEJO DE BODEGA INTERACTIVA ===
function calcularTotales() {
    ['entrada', 'pedido'].forEach(tipo => {
        let total = 0; 
        document.querySelectorAll(`#lista-${tipo}-dinamica .input-cant`).forEach(inp => { 
            total += (parseFloat(inp.value) || 0) * (parseFloat(inp.getAttribute('data-precio')) || 0); 
        });
        const label = document.getElementById(`gran-total-${tipo}`); 
        if (label) label.innerText = `Total: Q${total.toFixed(2)}`;
    });
}

window.generarListaInteractiva = function(idProv, contenedorId, tipo, filtro = '') {
    const cont = document.getElementById(contenedorId); if(!cont) return; cont.innerHTML = '';
    
    if (tipo === 'entrada') document.getElementById('btn-procesar-entrada-lote').style.display = 'block';
    if (tipo === 'salida') document.getElementById('btn-procesar-salida-lote').style.display = 'block';

    let prods = insumosGlobal;
    
    // Filtrar por proveedor si no es "todos"
    if (idProv !== 'todos' && idProv !== '') {
        const asigs = asignacionesGlobal.filter(a => a.id_proveedor == idProv);
        prods = asigs.map(a => {
            const p = insumosGlobal.find(i => i.id == a.id_insumo);
            if (p) p.precio_asignado = a.precio; 
            return p;
        }).filter(p => p);
    } else if (idProv === '') {
        calcularTotales();
        return; 
    }

    if (filtro !== '') {
        const tf = filtro.toLowerCase();
        prods = prods.filter(p => p.nombre.toLowerCase().includes(tf) || (p.codigo && p.codigo.toLowerCase().includes(tf)));
    }

    prods.forEach(i => {
        const pMostrar = i.precio_asignado || i.precio_compra || 0;
        cont.innerHTML += `
            <div class="item-lista" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                <div style="flex:1; text-align:left;">
                    <strong>${i.nombre}</strong><br>
                    <small style="color:gray;">Bodega: ${i.cantidad_actual} ${i.unidad_medida}</small>
                </div>
                <div class="control-cantidad" style="display:flex; align-items:center; gap:5px;">
                    <button class="btn-circulo btn-restar" style="width:30px; height:30px; border-radius:50%; background:#e5e7eb; border:none; cursor:pointer; font-weight:bold;">-</button>
                    <input type="number" class="input-cant cant-input" id="input-${tipo}-${i.id}" data-id="${i.id}" data-stock="${i.cantidad_actual}" data-precio="${pMostrar}" value="0" min="0" style="width:60px; text-align:center; padding:5px; border:1px solid #ccc; border-radius:4px;">
                    <button class="btn-circulo btn-sumar" style="width:30px; height:30px; border-radius:50%; background:#d1fae5; color:#065f46; border:none; cursor:pointer; font-weight:bold;">+</button>
                </div>
            </div>`;
    });
    calcularTotales();
}

window.procesarLote = async function(tipo) {
    let promesas = [];
    document.querySelectorAll(`#lista-${tipo}-dinamica .input-cant`).forEach(input => {
        const cant = parseFloat(input.value);
        if (cant > 0) {
            const nuevoStock = tipo === 'entrada' ? parseFloat(input.getAttribute('data-stock')) + cant : parseFloat(input.getAttribute('data-stock')) - cant;
            promesas.push(db.from('insumos').update({ cantidad_actual: nuevoStock }).eq('id', parseInt(input.getAttribute('data-id'), 10)));
        }
    });
    if (promesas.length > 0) { 
        await Promise.all(promesas); 
        alert("Bodega actualizada."); 
        cargarDatosMaestros(); 
    } else { alert("Agrega cantidades."); }
}

// === LISTENERS GLOBALES ===
document.addEventListener('DOMContentLoaded', () => {
    
    // Navegación Sidebar
    document.getElementById('btn-menu-toggle')?.addEventListener('click', () => { document.getElementById('sidebar').classList.add('abierta'); document.getElementById('btn-cerrar-menu').classList.remove('oculto'); });
    document.getElementById('btn-cerrar-menu')?.addEventListener('click', () => document.getElementById('sidebar').classList.remove('abierta'));
    document.querySelectorAll('.btn-nav').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-nav, .modulo').forEach(el => el.classList.remove('activo'));
            btn.classList.add('activo');
            document.getElementById(`modulo-${btn.getAttribute('data-modulo')}`).classList.add('activo');
            if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('abierta');
        });
    });

    cargarDatosMaestros();

    // Buscadores
    document.getElementById('buscador-insumo-receta')?.addEventListener('input', (e) => llenarSelectInsumosReceta(e.target.value));
    document.getElementById('buscador-insumos')?.addEventListener('input', (e) => renderizarInsumos(e.target.value));
    document.getElementById('buscador-directorio')?.addEventListener('input', (e) => renderizarDirectorioPrecios(e.target.value));

    // Mostrar ocultar opciones de subreceta
    document.getElementById('platillo-es-subreceta')?.addEventListener('change', (e) => {
        document.getElementById('opciones-subreceta').style.display = e.target.checked ? 'block' : 'none';
    });

    // Lógica Carrito Temporal
    document.getElementById('select-insumo-receta')?.addEventListener('change', (e) => {
        const ins = insumosGlobal.find(i => i.id == e.target.value);
        document.getElementById('display-precio-insumo').innerText = ins ? `Q${parseFloat(ins.precio_compra || 0).toFixed(2)} / ${ins.cantidad_compra||1} ${ins.unidad_medida}` : `Q0.00 / Unidad`;
        calcularEnVivo();
    });
    document.getElementById('receta-cantidad')?.addEventListener('input', calcularEnVivo);
    document.getElementById('receta-unidad')?.addEventListener('change', calcularEnVivo);

    document.getElementById('btn-add-carrito')?.addEventListener('click', () => {
        const idIns = document.getElementById('select-insumo-receta').value;
        const cant = parseFloat(document.getElementById('receta-cantidad').value);
        const uRec = document.getElementById('receta-unidad').value;
        if(!idIns || isNaN(cant) || cant <= 0) { alert("Completa el ingrediente y cantidad."); return; }

        const ins = insumosGlobal.find(i => i.id == idIns);
        const eq = obtenerEquivalencia(ins.unidad_medida, uRec);
        const pBase = (parseFloat(ins.precio_compra) || 0) / (parseFloat(ins.cantidad_compra) || 1);
        
        carritoIngredientes.push({ temp_id: Date.now(), id_insumo: idIns, nombre_insumo: ins.nombre, cantidad_usada: cant, unidad_receta: uRec, costo_calculado: (pBase/eq)*cant });
        
        document.getElementById('receta-cantidad').value = ""; document.getElementById('buscador-insumo-receta').value = ""; llenarSelectInsumosReceta();
        document.getElementById('display-precio-insumo').innerText = "Q0.00"; document.getElementById('panel-matematica').innerHTML = "Agregado. Ingresa otro.";
        renderTablaCarrito();
    });

    // 💾 GUARDAR RECETA (Y SUB-RECETA SI ESTÁ MARCADA)
    document.getElementById('form-maestro-receta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(carritoIngredientes.length === 0 && !window.confirm("¿Guardar receta SIN ingredientes?")) return;

        const idEd = document.getElementById('platillo-id').value;
        const nombrePlatillo = document.getElementById('platillo-nombre').value;
        const data = { nombre: nombrePlatillo, categoria: document.getElementById('platillo-categoria').value, porciones: parseFloat(document.getElementById('platillo-porciones').value)||1, margen_error: parseFloat(document.getElementById('platillo-margen').value)||10, porcentaje_costo_establecido: parseFloat(document.getElementById('platillo-porcentaje').value)||30 };
        
        // Verifica si existe el checkbox de subreceta
        const chkSub = document.getElementById('platillo-es-subreceta');
        const esSubreceta = chkSub ? chkSub.checked : false;
        const uniSubreceta = document.getElementById('platillo-unidad-subreceta') ? document.getElementById('platillo-unidad-subreceta').value : 'porcion';

        try {
            let idPlat = idEd;
            if(idEd === "") {
                const { data: d, error } = await db.from('platillos').insert([data]).select();
                if (error) throw error; idPlat = d[0].id;
            } else {
                const { error } = await db.from('platillos').update(data).eq('id', parseInt(idEd, 10));
                if (error) throw error;
                await db.from('platillo_insumo').delete().eq('id_platillo', idPlat);
            }
            if(carritoIngredientes.length > 0) {
                const inserts = carritoIngredientes.map(i => ({ id_platillo: idPlat, id_insumo: i.id_insumo, cantidad_usada: i.cantidad_usada, unidad_receta: i.unidad_receta }));
                const { error: err } = await db.from('platillo_insumo').insert(inserts);
                if (err) throw err;
            }
            
            await cargarDatosMaestros(); 
            
            // Lógica para guardar la receta en el inventario como sub-receta
            if (esSubreceta) {
                const costosReales = calcularCostoPlatilloReal(idPlat);
                const nombreInsumoSub = nombrePlatillo;
                const existeInsumo = insumosGlobal.find(i => i.nombre === nombreInsumoSub && i.categoria === 'subreceta');
                
                const dataInsumo = {
                    nombre: nombreInsumoSub,
                    categoria: 'subreceta',
                    unidad_medida: uniSubreceta,
                    cantidad_compra: data.porciones, 
                    precio_compra: costosReales.total, 
                    cantidad_actual: 0 
                };

                if (existeInsumo) {
                    await db.from('insumos').update(dataInsumo).eq('id', existeInsumo.id);
                } else {
                    await db.from('insumos').insert([dataInsumo]);
                }
                alert("¡Receta guardada y agregada al inventario como Sub-receta!");
            } else {
                alert("¡Receta guardada exitosamente!");
            }
            
            window.cancelarEdicionMaestro();
            cargarDatosMaestros();
        } catch (error) { alert(`Error al guardar: ${error.message}`); }
    });

    // GUARDAR INVENTARIO DIRECTO
    document.getElementById('form-insumo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEd = document.getElementById('insumo-id').value;
        const data = {
            codigo: document.getElementById('insumo-codigo').value, nombre: document.getElementById('insumo-nombre').value,
            unidad_medida: document.getElementById('insumo-unidad').value, cantidad_compra: parseFloat(document.getElementById('insumo-cantidad-compra').value)||1,
            precio_compra: parseFloat(document.getElementById('insumo-precio-compra').value)||0, stock_minimo: parseFloat(document.getElementById('insumo-minimo').value)||0,
            cantidad_actual: parseFloat(document.getElementById('insumo-inicial').value)||0, categoria: 'bodega'
        };
        const provR = document.getElementById('insumo-prov-rapido').value;

        try {
            let idF = idEd;
            if (idEd === "") {
                const { data: d, error } = await db.from('insumos').insert([data]).select();
                if (error) throw error; idF = d[0].id;
            } else {
                const { error } = await db.from('insumos').update(data).eq('id', parseInt(idEd, 10));
                if (error) throw error; idF = parseInt(idEd, 10);
                
                // Actualiza el precio vinculado a los proveedores existentes
                await db.from('proveedor_insumo').update({ precio: data.precio_compra }).eq('id_insumo', idF);
            }
            if (provR !== "") {
                const ex = asignacionesGlobal.find(a => a.id_proveedor == provR && a.id_insumo == idF);
                if (!ex) await db.from('proveedor_insumo').insert([{ id_proveedor: parseInt(provR, 10), id_insumo: idF, precio: data.precio_compra }]);
                else await db.from('proveedor_insumo').update({ precio: data.precio_compra }).eq('id', ex.id);
            }
            cancelarEdicion(); cargarDatosMaestros(); alert("Guardado correctamente.");
        } catch (error) { alert(`Error: ${error.message}`); }
    });

    // EVENTOS DE PROVEEDORES
    document.getElementById('form-proveedor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idProv = document.getElementById('prov-id').value;
        const data = { nombre: document.getElementById('prov-nombre').value, telefono: document.getElementById('prov-telefono').value };
        try {
            if(idProv === "") await db.from('proveedores').insert([data]); else await db.from('proveedores').update(data).eq('id', parseInt(idProv, 10));
            window.cancelarEdicionProv(); cargarDatosMaestros();
        } catch (err) { alert("Error al guardar proveedor."); }
    });

    document.getElementById('select-prov-asignar')?.addEventListener('change', (e) => {
        const idProv = e.target.value; const cnt = document.getElementById('contenedor-checklist'); cnt.innerHTML = '';
        if (!idProv) { document.getElementById('buscador-asignacion').style.display = 'none'; return; }
        const asigIds = asignacionesGlobal.filter(a => a.id_proveedor == idProv).map(a => a.id_insumo);
        const disp = insumosGlobal.filter(i => !asigIds.includes(i.id));
        if (disp.length > 0) {
            document.getElementById('buscador-asignacion').style.display = 'block';
            disp.forEach(i => cnt.innerHTML += `<label class="checklist-item"><input type="checkbox" class="check-insumo" value="${i.id}"> ${i.nombre}</label>`);
        }
    });

    document.getElementById('form-asignacion')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const idProv = document.getElementById('select-prov-asignar').value;
        const chks = document.querySelectorAll('.check-insumo:checked'); if (chks.length === 0) return;
        const inserts = Array.from(chks).map(cb => {
            const ins = insumosGlobal.find(i => i.id == cb.value);
            return { id_proveedor: parseInt(idProv, 10), id_insumo: parseInt(cb.value, 10), precio: ins ? ins.precio_compra : 0 };
        });
        await db.from('proveedor_insumo').insert(inserts); document.getElementById('select-prov-asignar').dispatchEvent(new Event('change')); cargarDatosMaestros();
    });

    // DELEGACIÓN CLICS GENERALES
    document.body.addEventListener('click', async (e) => {
        
        // SINCRONIZACIÓN BIFACIAL DE PRECIOS
        const btnEditarPrecio = e.target.closest('.btn-editar-precio');
        if (btnEditarPrecio) {
            const idAsig = parseInt(btnEditarPrecio.getAttribute('data-id'), 10);
            const precioActual = btnEditarPrecio.getAttribute('data-precio');
            const nuevoPrecio = prompt("Ingrese el nuevo precio del proveedor:", precioActual);
            
            if (nuevoPrecio !== null && nuevoPrecio.trim() !== "" && !isNaN(parseFloat(nuevoPrecio))) {
                try {
                    await db.from('proveedor_insumo').update({ precio: parseFloat(nuevoPrecio) }).eq('id', idAsig);
                    const asig = asignacionesGlobal.find(a => a.id == idAsig);
                    if(asig) {
                        await db.from('insumos').update({ precio_compra: parseFloat(nuevoPrecio) }).eq('id', asig.id_insumo);
                    }
                    cargarDatosMaestros();
                } catch (err) { alert("Error al actualizar precio."); }
            }
            return;
        }

        const btnQuitar = e.target.closest('.btn-quitar-asignacion');
        if (btnQuitar) { await db.from('proveedor_insumo').delete().eq('id', parseInt(btnQuitar.getAttribute('data-id'), 10)); cargarDatosMaestros(); return; }
        
        const btnEdProv = e.target.closest('.btn-editar-prov');
        if (btnEdProv) {
            const p = proveedoresGlobal.find(pr => pr.id == btnEdProv.getAttribute('data-id'));
            if (p) { document.getElementById('prov-id').value = p.id; document.getElementById('prov-nombre').value = p.nombre; document.getElementById('prov-telefono').value = p.telefono; document.getElementById('btn-guardar-prov').innerText = "Actualizar"; document.getElementById('btn-cancelar-prov').classList.remove('oculto'); } return;
        }
        
        const btnElmProv = e.target.closest('.btn-eliminar-prov');
        if (btnElmProv && window.confirm("¿Borrar Proveedor?")) { await db.from('proveedores').delete().eq('id', parseInt(btnElmProv.getAttribute('data-id'), 10)); cargarDatosMaestros(); return; }

        const btnEdIns = e.target.closest('.btn-editar-insumo');
        if (btnEdIns) {
            const ins = insumosGlobal.find(i => i.id == btnEdIns.getAttribute('data-id'));
            if (ins) {
                document.getElementById('insumo-id').value = ins.id; document.getElementById('insumo-codigo').value = ins.codigo || '';
                document.getElementById('insumo-nombre').value = ins.nombre || ''; document.getElementById('insumo-unidad').value = ins.unidad_medida || '';
                document.getElementById('insumo-cantidad-compra').value = ins.cantidad_compra || 1; document.getElementById('insumo-precio-compra').value = ins.precio_compra || '';
                document.getElementById('insumo-minimo').value = ins.stock_minimo || 0; document.getElementById('insumo-inicial').value = ins.cantidad_actual || 0;
                
                document.getElementById('titulo-formulario').innerText = "Editando Producto";
                document.getElementById('btn-guardar').innerText = "Actualizar Cambios";
                document.getElementById('btn-guardar').classList.replace('btn-primario', 'btn-editar');
                document.getElementById('btn-cancelar').classList.remove('oculto');
                
                document.querySelectorAll('.btn-nav, .modulo').forEach(el => el.classList.remove('activo'));
                document.querySelector('.btn-nav[data-modulo="productos"]').classList.add('activo');
                document.getElementById('modulo-productos').classList.add('activo');
                document.getElementById('area-scroll').scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }
        
        const btnElimIns = e.target.closest('.btn-eliminar');
        if (btnElimIns && window.confirm("¿Eliminar producto de inventario?")) {
            await db.from('insumos').delete().eq('id', parseInt(btnElimIns.getAttribute('data-id'), 10));
            cargarDatosMaestros(); return;
        }

        const btnDescontar = e.target.closest('#form-produccion button[type="submit"]');
        if (btnDescontar) {
            e.preventDefault();
            const idPlat = document.getElementById('select-platillo-produccion').value;
            const cP = parseFloat(document.getElementById('cantidad-produccion').value);
            if(!idPlat || isNaN(cP)) return;
            const ingrs = recetasGlobal.filter(r => r.id_platillo == idPlat);
            let promesas = [];
            ingrs.forEach(ing => {
                const ins = insumosGlobal.find(i => i.id == ing.id_insumo);
                if (ins) {
                    const eq = obtenerEquivalencia(ins.unidad_medida, ing.unidad_receta);
                    promesas.push(db.from('insumos').update({cantidad_actual: parseFloat(ins.cantidad_actual) - ((ing.cantidad_usada/eq)*cP)}).eq('id', ins.id));
                }
            });
            await Promise.all(promesas); alert(`✅ Descontado de bodega.`); document.getElementById('form-produccion').reset(); cargarDatosMaestros();
        }

        // BODEGA MANUAL
        const btnSumar = e.target.closest('.btn-sumar');
        if (btnSumar) { const input = btnSumar.previousElementSibling; input.value = parseInt(input.value) + 1; calcularTotales(); return; }
        
        const btnRestar = e.target.closest('.btn-restar');
        if (btnRestar) { const input = btnRestar.nextElementSibling; if (parseInt(input.value) > 0) input.value = parseInt(input.value) - 1; calcularTotales(); return; }
        
        // IMPRESIÓN DE FICHAS
        const btnImprimirFicha = e.target.closest('.btn-imprimir-ficha');
        if (btnImprimirFicha) { window.imprimirFichaTecnica(btnImprimirFicha.getAttribute('data-id')); return; }
    });

    // LISTENERS DE LOS SELECTS DE BODEGA
    document.getElementById('select-prov-entrada')?.addEventListener('change', (e) => { document.getElementById('buscador-entrada').value = ''; generarListaInteractiva(e.target.value, 'lista-entrada-dinamica', 'entrada'); });
    document.getElementById('buscador-entrada')?.addEventListener('input', (e) => { generarListaInteractiva('todos', 'lista-entrada-dinamica', 'entrada', e.target.value); });
    document.getElementById('select-prov-salida')?.addEventListener('change', (e) => { document.getElementById('buscador-salida').value = ''; generarListaInteractiva(e.target.value, 'lista-salida-dinamica', 'salida'); });
    document.getElementById('buscador-salida')?.addEventListener('input', (e) => { generarListaInteractiva('todos', 'lista-salida-dinamica', 'salida', e.target.value); });
    document.getElementById('select-prov-pedido')?.addEventListener('change', (e) => { document.getElementById('buscador-pedido').value = ''; generarListaInteractiva(e.target.value, 'lista-pedido-dinamica', 'pedido'); document.getElementById('btn-imprimir-pedido').style.display = e.target.value ? 'block' : 'none'; });
    
    document.body.addEventListener('input', (e) => { if(e.target.classList.contains('input-cant')) calcularTotales(); });
});

window.cancelarEdicion = function() {
    document.getElementById('form-insumo').reset(); document.getElementById('insumo-id').value = "";
    document.getElementById('btn-guardar').innerText = "Guardar Producto"; document.getElementById('btn-guardar').classList.replace('btn-editar', 'btn-primario');
    document.getElementById('btn-cancelar').classList.add('oculto');
}

window.cancelarEdicionProv = function() {
    document.getElementById('form-proveedor').reset(); document.getElementById('prov-id').value = ""; 
    document.getElementById('btn-guardar-prov').innerText = "Guardar Proveedor"; document.getElementById('btn-guardar-prov').classList.replace('btn-editar', 'btn-primario'); 
    document.getElementById('btn-cancelar-prov').classList.add('oculto');
}

// === IMPRESIONES PDF Y REPORTES ===
window.imprimirFichaTecnica = function(idPlatillo) {
    const platillo = platillosGlobal.find(p => p.id == idPlatillo); if (!platillo) return;
    const ingrs = recetasGlobal.filter(r => r.id_platillo == idPlatillo);
    if(ingrs.length === 0) { alert("Sin ingredientes."); return; }

    let costoMP = 0; let filas = '';
    ingrs.forEach(ing => {
        const ins = insumosGlobal.find(i => i.id == ing.id_insumo);
        if (ins) {
            const pBase = (parseFloat(ins.precio_compra) || 0) / (parseFloat(ins.cantidad_compra) || 1);
            const eq = obtenerEquivalencia(ins.unidad_medida, ing.unidad_receta);
            const cUnit = pBase / eq; const cTot = cUnit * parseFloat(ing.cantidad_usada);
            costoMP += cTot;
            filas += `<tr><td style="padding:5px; border:1px solid #000;">${ins.nombre}</td><td style="padding:5px; border:1px solid #000; text-align:center;">${ing.cantidad_usada}</td><td style="padding:5px; border:1px solid #000; text-align:center;">${ing.unidad_receta}</td><td style="padding:5px; border:1px solid #000; text-align:right;">Q${cUnit.toFixed(4)}</td><td style="padding:5px; border:1px solid #000; text-align:right;">Q${cTot.toFixed(2)}</td></tr>`;
        }
    });

    const mrg = costoMP * ((parseFloat(platillo.margen_error)||0)/100);
    const cTot = costoMP + mrg;
    const cPor = cTot / (parseFloat(platillo.porciones)||1);
    const pSug = cPor / ((parseFloat(platillo.porcentaje_costo_establecido)||30)/100);

    const html = `<html><head><title>Ficha - ${platillo.nombre}</title><style>body{font-family:Arial; font-size:13px; margin:30px;} table{width:100%; border-collapse:collapse; margin-bottom:25px;} .bg-dark{background:#1e3a8a; color:white; font-weight:bold; text-align:center; padding:10px;} .bg-light{background:#bfdbfe; color:#1e3a8a; font-weight:bold; text-align:center; padding:8px;} td{padding:6px; border:1px solid #000;} .label-td{font-weight:bold; background:#f3f4f6;} .resumen-label{text-align:right; font-weight:bold; background:#fef3c7;}</style></head><body><table><tr><td colspan="2" class="bg-dark">RECETA Y COSTO</td></tr><tr><td class="label-td">Platillo</td><td>${platillo.nombre}</td></tr><tr><td class="label-td">Porciones</td><td>${platillo.porciones||1}</td></tr></table><table><tr><td colspan="5" class="bg-light">INGREDIENTES</td></tr><tr><td>Ingrediente</td><td>Cant</td><td>Unidad</td><td>Costo Unit.</td><td>Costo Tot.</td></tr>${filas}</table><table style="width:60%; margin-left:auto;"><tr><td class="resumen-label">Costo Materia Prima</td><td style="text-align:right;">Q${costoMP.toFixed(2)}</td></tr><tr><td class="resumen-label">Margen de Error/Merma</td><td style="text-align:right;">Q${mrg.toFixed(2)}</td></tr><tr><td class="resumen-label">Costo Real por Porción</td><td style="text-align:right; font-weight:bold; background:yellow;">Q${cPor.toFixed(2)}</td></tr><tr><td class="resumen-label">Precio Sugerido Venta</td><td style="text-align:right; font-weight:bold; color:green;">Q${pSug.toFixed(2)}</td></tr></table><div style="text-align:center; margin-top:20px;"><button onclick="window.print()">Imprimir Ficha</button></div></body></html>`;
    const v = window.open('', '_blank'); v.document.write(html); v.document.close();
}

window.imprimirPedidoManual = function() {
    const provSel = document.getElementById('select-prov-pedido');
    const provNom = provSel.options[provSel.selectedIndex].text;
    let html = ''; let tot = 0; let hay = false;
    document.querySelectorAll('#lista-pedido-dinamica .input-cant').forEach(inp => {
        const cant = parseInt(inp.value);
        if(cant > 0) { hay=true; const ins = insumosGlobal.find(i => i.id == inp.id.split('-')[2]); const p = parseFloat(inp.getAttribute('data-precio'))||0; const sub = cant*p; tot+=sub; html+=`<tr><td>${ins.nombre}</td><td style="text-align:center;">${cant} ${ins.unidad_medida}</td><td style="text-align:right;">Q${p.toFixed(2)}</td><td style="text-align:right;">Q${sub.toFixed(2)}</td></tr>`; }
    });
    if(!hay) { alert("Agrega cantidades."); return; }
    const res = `<html><head><title>Orden de Compra</title></head><body style="font-family:Arial; padding:20px;"><h1>Orden de Compra</h1><h3>Proveedor: ${provNom}</h3><p>Fecha: ${new Date().toLocaleDateString()}</p><table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;"><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr>${html}<tr><td colspan="3" align="right"><b>TOTAL:</b></td><td align="right" style="color:green; font-size:1.2em;"><b>Q${tot.toFixed(2)}</b></td></tr></table><br><button onclick="window.print()">Imprimir</button></body></html>`;
    const v = window.open('', '_blank'); v.document.write(res); v.document.close();
}

window.imprimirReporteAutomatico = function() {
    let html = `<html><head><title>Faltantes</title></head><body style="font-family:Arial; padding:20px;"><h1>Reporte de Faltantes</h1><p>Fecha: ${new Date().toLocaleDateString()}</p><hr>`;
    let hay = false;
    proveedoresGlobal.forEach(prov => {
        const asigs = asignacionesGlobal.filter(a => a.id_proveedor == prov.id);
        const f = asigs.map(a => insumosGlobal.find(i => i.id == a.id_insumo)).filter(i => i && parseFloat(i.cantidad_actual) <= parseFloat(i.stock_minimo) && i.categoria !== 'subreceta');
        if (f.length > 0) {
            hay = true; html += `<h3>${prov.nombre}</h3><table border="1" cellpadding="5" style="border-collapse:collapse; width:100%;"><tr><th>Producto</th><th>Bodega</th><th>Mínimo</th></tr>`;
            f.forEach(p => { html += `<tr><td>${p.nombre}</td><td style="color:red; font-weight:bold;">${p.cantidad_actual} ${p.unidad_medida}</td><td>${p.stock_minimo}</td></tr>`; });
            html += `</table><br>`;
        }
    });
    if(!hay) html += `<p style="color:green; font-weight:bold;">Todo en orden. Inventario estable.</p>`;
    html += `<button onclick="window.print()">Imprimir Reporte</button></body></html>`;
    const v = window.open('', '_blank'); v.document.write(html); v.document.close();
}