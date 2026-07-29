const supabaseUrl = 'https://cdblyqtxpuxnhwbxykfh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkYmx5cXR4cHV4bmh3Ynh5a2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDgxMjksImV4cCI6MjA5OTc4NDEyOX0.XMozUuwLYLz3vB8UokwLNX-E-wJZr4QdVnkcVynvnjk';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let insumosGlobal = [];
let proveedoresGlobal = [];
let asignacionesGlobal = [];

async function cargarDatosMaestros() {
    try {
        const resInsumos = await db.from('insumos').select('*').order('id', { ascending: true });
        const resProv = await db.from('proveedores').select('*').order('id', { ascending: true });
        const resAsig = await db.from('proveedor_insumo').select('id, id_proveedor, id_insumo, precio'); 

        insumosGlobal = resInsumos.data || [];
        proveedoresGlobal = resProv.data || [];
        asignacionesGlobal = resAsig.data || [];

        if(document.getElementById('buscador-insumos')) document.getElementById('buscador-insumos').value = "";
        if(document.getElementById('buscador-entrada')) document.getElementById('buscador-entrada').value = "";
        if(document.getElementById('buscador-salida')) document.getElementById('buscador-salida').value = "";
        if(document.getElementById('buscador-pedido')) document.getElementById('buscador-pedido').value = "";

        renderizarInsumos();
        renderizarProveedores();
        renderizarCatalogoProveedores();
        
        document.getElementById('select-prov-entrada').dispatchEvent(new Event('change'));
        document.getElementById('select-prov-salida').dispatchEvent(new Event('change'));
        document.getElementById('select-prov-pedido').dispatchEvent(new Event('change'));
        
        document.getElementById('select-prov-asignar').dispatchEvent(new Event('change'));

    } catch (error) {
        console.error("Error cargando datos:", error.message);
    }
}

function renderizarInsumos(filtro = '') {
    const tbody = document.getElementById('tabla-insumos-body');
    const contenedorAlertas = document.getElementById('contenedor-alertas-panel');
    let contadorAlertas = 0;

    tbody.innerHTML = '';
    
    if (filtro === '' && contenedorAlertas) {
        contenedorAlertas.innerHTML = ''; 
    }

    const textoBusqueda = filtro.toLowerCase();

    insumosGlobal.forEach(insumo => {
        const stockActual = parseFloat(insumo.cantidad_actual);
        const stockMinimo = parseFloat(insumo.stock_minimo);
        let colorStock = 'color: var(--verde); font-weight: bold;';
        
        if (stockActual <= stockMinimo) {
            colorStock = 'color: var(--rojo-texto); font-weight: bold;';
            if (filtro === '' && contenedorAlertas) {
                contadorAlertas++;
                contenedorAlertas.innerHTML += `
                    <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid var(--borde); display: flex; justify-content: space-between;">
                        <span><strong>${insumo.codigo ? `[${insumo.codigo}] ` : ''}${insumo.nombre}</strong></span>
                        <span style="color: var(--rojo-texto); font-weight: bold;">Quedan: ${stockActual} ${insumo.unidad_medida}</span>
                    </div>
                `;
            }
        }

        const nombreInsumo = insumo.nombre ? insumo.nombre.toLowerCase() : '';
        const codigoInsumo = insumo.codigo ? insumo.codigo.toLowerCase() : '';

        if (nombreInsumo.includes(textoBusqueda) || codigoInsumo.includes(textoBusqueda)) {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--borde);">
                    <td style="padding: 10px; font-weight: bold; color: var(--azul);">${insumo.codigo || '---'}</td>
                    <td style="padding: 10px;">${insumo.nombre}</td>
                    <td style="padding: 10px;">${insumo.unidad_medida}</td>
                    <td style="padding: 10px;">${insumo.stock_minimo}</td>
                    <td style="padding: 10px;"><span style="${colorStock}">${insumo.cantidad_actual}</span></td>
                    <td style="padding: 10px; text-align: center;">
                        <button class="btn btn-editar-insumo" data-id="${insumo.id}" style="background-color: var(--naranja); color: white; padding: 6px 12px; margin-right: 5px; margin-bottom: 5px; cursor: pointer; border: none; border-radius: 4px;">Editar</button>
                        <button class="btn btn-peligro btn-eliminar" data-id="${insumo.id}" style="padding: 6px 12px; cursor: pointer; border: none; border-radius: 4px;">Borrar</button>
                    </td>
                </tr>
            `;
        }
    });

    if (filtro === '' && contenedorAlertas && contadorAlertas === 0) {
        contenedorAlertas.innerHTML = '<p style="color: var(--verde); font-weight: bold;">Todo el inventario está en niveles óptimos.</p>';
    }
}

function renderizarProveedores() {
    const selects = ['select-prov-asignar', 'select-prov-entrada', 'select-prov-pedido'];
    const selectProvRapido = document.getElementById('insumo-prov-rapido');
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        const placeholder = id === 'select-prov-asignar' ? '1. Seleccionar Proveedor...' : (id === 'select-prov-entrada' ? 'Seleccione proveedor...' : 'Seleccione a quién le va a pedir...');
        select.innerHTML = `<option value="">${placeholder}</option>`;
        
        if (id === 'select-prov-entrada') {
            select.innerHTML += '<option value="todos">Mostrar TODOS los productos (Ingreso Libre)</option>';
        }
        
        proveedoresGlobal.forEach(prov => {
            select.innerHTML += `<option value="${prov.id}">${prov.nombre}</option>`;
        });
    });

    // Llenar el select rápido en la creación de insumos
    if (selectProvRapido) {
        selectProvRapido.innerHTML = '<option value="">Sin asignar por ahora</option>';
        proveedoresGlobal.forEach(prov => {
            selectProvRapido.innerHTML += `<option value="${prov.id}">${prov.nombre}</option>`;
        });
    }

    const selectSalida = document.getElementById('select-prov-salida');
    selectSalida.innerHTML = '<option value="todos">Mostrar TODOS los productos</option>';
    proveedoresGlobal.forEach(prov => {
        selectSalida.innerHTML += `<option value="${prov.id}">Filtrar por: ${prov.nombre}</option>`;
    });
}

function renderizarCatalogoProveedores() {
    const contenedor = document.getElementById('contenedor-catalogo-proveedores');
    contenedor.innerHTML = '';

    proveedoresGlobal.forEach(prov => {
        const susAsignaciones = asignacionesGlobal.filter(a => a.id_proveedor == prov.id);
        let htmlProductos = '';
        
        if (susAsignaciones.length === 0) {
            htmlProductos = '<p style="color: gray; font-size: 0.9em; margin-top: 5px;">No tiene productos asignados aún.</p>';
        } else {
            htmlProductos = '<ul style="list-style:none; padding:0; margin-top: 10px;">';
            susAsignaciones.forEach(asig => {
                const insumoReal = insumosGlobal.find(i => i.id == asig.id_insumo);
                if(insumoReal) {
                    const nombreMostrar = insumoReal.codigo ? `[${insumoReal.codigo}] ${insumoReal.nombre}` : insumoReal.nombre;
                    const precio = asig.precio ? parseFloat(asig.precio).toFixed(2) : "0.00";
                    
                    htmlProductos += `
                        <li style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px dashed #ccc; flex-wrap: wrap; gap: 5px;">
                            <span>📦 ${nombreMostrar} - <strong>Q${precio}</strong></span>
                            <div>
                                <button class="btn btn-editar-precio" data-id="${asig.id}" data-precio="${precio}" style="padding: 4px 8px; font-size: 0.85em; background-color: var(--naranja); color: white; border: none; border-radius: 3px; cursor:pointer;">Editar Precio</button>
                                <button class="btn btn-peligro btn-quitar-asignacion" data-id="${asig.id}" style="padding: 4px 8px; font-size: 0.85em; cursor:pointer;">Quitar</button>
                            </div>
                        </li>`;
                }
            });
            htmlProductos += '</ul>';
        }

        contenedor.innerHTML += `
            <div style="border: 1px solid var(--borde); padding: 15px; border-radius: 5px; margin-bottom: 15px; background: #f9fafb;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="margin: 0; color: var(--azul); font-size: 1.2rem;">${prov.nombre}</h4>
                        <span style="display: inline-block; margin-top: 5px; background: #e5e7eb; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #374151;">Tel: ${prov.telefono}</span>
                    </div>
                    <div>
                        <button class="btn btn-editar-prov" data-id="${prov.id}" style="background-color: var(--naranja); color: white; padding: 5px 10px; margin-right: 5px; cursor: pointer; border: none; border-radius: 4px;">Editar</button>
                        <button class="btn btn-eliminar-prov" data-id="${prov.id}" style="background-color: #ef4444; color: white; padding: 5px 10px; border: none; cursor: pointer; border-radius: 4px;">Borrar</button>
                    </div>
                </div>
                ${htmlProductos}
            </div>
        `;
    });
}

function calcularTotales() {
    ['entrada', 'pedido'].forEach(tipo => {
        const inputs = document.querySelectorAll(`#lista-${tipo}-dinamica .input-cant`);
        let total = 0;
        inputs.forEach(inp => {
            const cant = parseFloat(inp.value) || 0;
            const prec = parseFloat(inp.getAttribute('data-precio')) || 0;
            total += cant * prec;
        });
        const label = document.getElementById(`gran-total-${tipo}`);
        if (label) label.innerText = `Total: Q${total.toFixed(2)}`;
    });
}

function generarListaInteractiva(idProv, contenedorId, tipo, filtro = '') {
    const contenedor = document.getElementById(contenedorId);
    contenedor.innerHTML = '';
    
    if (tipo === 'entrada') document.getElementById('btn-procesar-entrada-lote').style.display = idProv ? 'block' : 'none';
    if (tipo === 'salida') document.getElementById('btn-procesar-salida-lote').style.display = idProv ? 'block' : 'none';

    if(!idProv) {
        calcularTotales();
        return;
    }

    let productos = [];
    if (idProv === 'todos') {
        productos = insumosGlobal.map(i => ({ insumo: i, precio: 0 }));
    } else {
        const asignaciones = asignacionesGlobal.filter(a => a.id_proveedor == idProv);
        productos = asignaciones.map(a => {
            return {
                insumo: insumosGlobal.find(i => i.id == a.id_insumo),
                precio: a.precio || 0
            };
        }).filter(p => p.insumo);
    }

    const textoBusqueda = filtro.toLowerCase();
    if (textoBusqueda !== '') {
        productos = productos.filter(p => {
            const nombre = p.insumo.nombre ? p.insumo.nombre.toLowerCase() : '';
            const codigo = p.insumo.codigo ? p.insumo.codigo.toLowerCase() : '';
            return nombre.includes(textoBusqueda) || codigo.includes(textoBusqueda);
        });
    }

    if(productos.length === 0) {
        contenedor.innerHTML = '<p style="color: gray;">No hay productos para mostrar.</p>';
        calcularTotales();
        return;
    }

    productos.forEach(prod => {
        const i = prod.insumo;
        const nombreMostrar = i.codigo ? `[${i.codigo}] ${i.nombre}` : i.nombre;
        const infoPrecio = idProv !== 'todos' ? `<br><small style="color: var(--verde); font-weight: bold;">Precio Unit: Q${parseFloat(prod.precio).toFixed(2)}</small>` : '';

        contenedor.innerHTML += `
            <div class="item-lista">
                <div style="flex: 1; text-align: left;">
                    <strong>${nombreMostrar}</strong><br>
                    <small style="color: gray;">Bodega: ${i.cantidad_actual} ${i.unidad_medida}</small>
                    ${infoPrecio}
                </div>
                <div class="control-cantidad">
                    <button class="btn-circulo btn-restar">-</button>
                    <input type="number" class="input-cant cant-input" id="input-${tipo}-${i.id}" data-id="${i.id}" data-stock="${i.cantidad_actual}" data-precio="${prod.precio}" value="0" min="0">
                    <button class="btn-circulo btn-sumar">+</button>
                </div>
            </div>
        `;
    });
    calcularTotales();
}

window.procesarLote = async function(tipo) {
    const inputs = document.querySelectorAll(`#lista-${tipo}-dinamica .input-cant`);
    let promesas = [];
    let itemsModificados = 0;

    inputs.forEach(input => {
        const cantidadModificar = parseFloat(input.value);
        if (cantidadModificar > 0) {
            const id = parseInt(input.getAttribute('data-id'), 10);
            const stockActual = parseFloat(input.getAttribute('data-stock'));
            const nuevoStock = tipo === 'entrada' ? stockActual + cantidadModificar : stockActual - cantidadModificar;
            
            promesas.push(db.from('insumos').update({ cantidad_actual: nuevoStock }).eq('id', id));
            itemsModificados++;
        }
    });

    if (itemsModificados === 0) {
        alert("No has puesto cantidades en ningún producto. Usa el botón + o escribe un número primero.");
        return;
    }

    try {
        const resultados = await Promise.all(promesas);
        const errores = resultados.filter(r => r.error);
        
        if (errores.length > 0) throw new Error("Algunos productos no se pudieron actualizar.");

        cargarDatosMaestros();
        alert(`¡Éxito! Se guardaron ${itemsModificados} movimientos en bodega.`);
    } catch (error) {
        alert(`Error al guardar el lote: ${error.message}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosMaestros();

    const btnToggleMenu = document.getElementById('btn-menu-toggle');
    const btnCerrarMenu = document.getElementById('btn-cerrar-menu');
    const sidebar = document.getElementById('sidebar');

    if (btnToggleMenu) {
        btnToggleMenu.addEventListener('click', () => {
            sidebar.classList.add('abierta');
            if(window.innerWidth <= 768) btnCerrarMenu.classList.remove('oculto');
        });
    }
    
    if (btnCerrarMenu) {
        btnCerrarMenu.addEventListener('click', () => {
            sidebar.classList.remove('abierta');
        });
    }

    const buscadorCat = document.getElementById('buscador-insumos');
    if (buscadorCat) buscadorCat.addEventListener('input', (e) => renderizarInsumos(e.target.value));

    const buscadorAsig = document.getElementById('buscador-asignacion');
    if(buscadorAsig) {
        buscadorAsig.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.checklist-item');
            items.forEach(item => {
                const contenido = item.textContent.toLowerCase();
                if(contenido.includes(texto)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    const buscadorEntrada = document.getElementById('buscador-entrada');
    if (buscadorEntrada) {
        buscadorEntrada.addEventListener('input', (e) => {
            const provId = document.getElementById('select-prov-entrada').value;
            generarListaInteractiva(provId, 'lista-entrada-dinamica', 'entrada', e.target.value);
        });
    }

    const buscadorSalida = document.getElementById('buscador-salida');
    if (buscadorSalida) {
        buscadorSalida.addEventListener('input', (e) => {
            const provId = document.getElementById('select-prov-salida').value;
            generarListaInteractiva(provId, 'lista-salida-dinamica', 'salida', e.target.value);
        });
    }

    const buscadorPedido = document.getElementById('buscador-pedido');
    if (buscadorPedido) {
        buscadorPedido.addEventListener('input', (e) => {
            const provId = document.getElementById('select-prov-pedido').value;
            generarListaInteractiva(provId, 'lista-pedido-dinamica', 'pedido', e.target.value);
        });
    }

    document.body.addEventListener('input', (e) => {
        if(e.target.classList.contains('input-cant')) {
            calcularTotales();
        }
    });

    document.querySelectorAll('.btn-nav').forEach(boton => {
        boton.addEventListener('click', () => {
            document.querySelectorAll('.btn-nav, .modulo').forEach(el => el.classList.remove('activo'));
            boton.classList.add('activo');
            document.getElementById(`modulo-${boton.getAttribute('data-modulo')}`).classList.add('activo');
            
            if(window.innerWidth <= 768) {
                sidebar.classList.remove('abierta');
            }
        });
    });

    // --- GUARDAR INSUMO Y CREAR ASIGNACIÓN RÁPIDA ---
    document.getElementById('form-insumo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicion = document.getElementById('insumo-id').value;
        const codigo = document.getElementById('insumo-codigo').value; 
        const nombre = document.getElementById('insumo-nombre').value;
        const unidad = document.getElementById('insumo-unidad').value;
        const stockMinimo = parseFloat(document.getElementById('insumo-minimo').value) || 0;
        const stockActual = parseFloat(document.getElementById('insumo-inicial').value) || 0;
        
        const idProvRapido = document.getElementById('insumo-prov-rapido').value;
        const precioRapido = parseFloat(document.getElementById('insumo-precio-rapido').value) || 0;

        try {
            let idInsumoFinal = idEdicion;

            if (idEdicion === "") {
                // Insertar con .select() para obtener el ID que Supabase le dio
                const { data, error } = await db.from('insumos')
                    .insert([{ codigo, nombre, unidad_medida: unidad, stock_minimo: stockMinimo, cantidad_actual: stockActual }])
                    .select();
                if (error) throw error;
                idInsumoFinal = data[0].id;
            } else {
                const idNumerico = parseInt(idEdicion, 10);
                const { error } = await db.from('insumos')
                    .update({ codigo, nombre, unidad_medida: unidad, stock_minimo: stockMinimo, cantidad_actual: stockActual })
                    .eq('id', idNumerico);
                if (error) throw error;
                idInsumoFinal = idNumerico;
            }

            // GESTIONAR LA ASIGNACIÓN RÁPIDA DE PROVEEDOR Y PRECIO
            if (idProvRapido !== "") {
                const existeAsignacion = asignacionesGlobal.find(a => a.id_proveedor == idProvRapido && a.id_insumo == idInsumoFinal);
                if (existeAsignacion) {
                    await db.from('proveedor_insumo').update({ precio: precioRapido }).eq('id', existeAsignacion.id);
                } else {
                    await db.from('proveedor_insumo').insert([{ id_proveedor: parseInt(idProvRapido, 10), id_insumo: idInsumoFinal, precio: precioRapido }]);
                }
            }

            cancelarEdicion();
            cargarDatosMaestros(); 
            alert("Producto guardado exitosamente.");
        } catch (error) { 
            console.error(error);
            alert(`Error al guardar producto: ${error.message}`); 
        }
    });

    document.getElementById('form-proveedor').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idProv = document.getElementById('prov-id').value;
        const nombre = document.getElementById('prov-nombre').value;
        const telefono = document.getElementById('prov-telefono').value;
        
        try {
            if(idProv === "") {
                const { error } = await db.from('proveedores').insert([{ nombre, telefono }]);
                if (error) throw error;
                alert("Proveedor guardado exitosamente.");
            } else {
                const { error } = await db.from('proveedores').update({ nombre, telefono }).eq('id', parseInt(idProv, 10));
                if (error) throw error;
                alert("Proveedor actualizado exitosamente.");
            }
            cancelarEdicionProv();
            cargarDatosMaestros();
        } catch (error) { alert(`Error al guardar proveedor: ${error.message}`); }
    });

    document.getElementById('select-prov-asignar').addEventListener('change', (e) => {
        const idProv = e.target.value;
        const contenedorChecklist = document.getElementById('contenedor-checklist');
        const buscadorAsig = document.getElementById('buscador-asignacion');
        
        contenedorChecklist.innerHTML = '';

        if (!idProv) {
            contenedorChecklist.innerHTML = '<p style="color: gray; font-size: 0.9em; text-align: center; margin-top: 10px;">Selecciona un proveedor primero.</p>';
            buscadorAsig.style.display = 'none';
            return;
        }

        const asignadosId = asignacionesGlobal.filter(a => a.id_proveedor == idProv).map(a => a.id_insumo);
        const disponibles = insumosGlobal.filter(i => !asignadosId.includes(i.id));

        if (disponibles.length === 0) {
            contenedorChecklist.innerHTML = '<p style="color: var(--verde); font-weight: bold; text-align: center; margin-top: 10px;">Todos los productos ya están asignados a este proveedor.</p>';
            buscadorAsig.style.display = 'none';
        } else {
            buscadorAsig.style.display = 'block';
            buscadorAsig.value = '';
            
            disponibles.forEach(insumo => {
                const nombreMostrar = insumo.codigo ? `[${insumo.codigo}] ${insumo.nombre}` : insumo.nombre;
                contenedorChecklist.innerHTML += `
                    <label class="checklist-item">
                        <input type="checkbox" class="check-insumo" value="${insumo.id}"> 
                        ${nombreMostrar}
                    </label>
                `;
            });
        }
    });

    document.getElementById('form-asignacion').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idProv = document.getElementById('select-prov-asignar').value;
        const checkboxes = document.querySelectorAll('.check-insumo:checked');
        
        if (checkboxes.length === 0) {
            alert("Por favor marca al menos una casilla.");
            return;
        }

        try {
            const inserts = Array.from(checkboxes).map(cb => ({
                id_proveedor: parseInt(idProv, 10),
                id_insumo: parseInt(cb.value, 10),
                precio: 0 
            }));

            const { error } = await db.from('proveedor_insumo').insert(inserts);
            if (error) throw error;
            
            document.getElementById('select-prov-asignar').dispatchEvent(new Event('change'));
            cargarDatosMaestros();
            alert("Productos vinculados correctamente.");
        } catch (error) { 
            alert(`Error al vincular: ${error.message}`); 
        }
    });

    document.getElementById('select-prov-entrada').addEventListener('change', (e) => {
        document.getElementById('buscador-entrada').value = '';
        generarListaInteractiva(e.target.value, 'lista-entrada-dinamica', 'entrada');
    });
    document.getElementById('select-prov-salida').addEventListener('change', (e) => {
        document.getElementById('buscador-salida').value = '';
        generarListaInteractiva(e.target.value, 'lista-salida-dinamica', 'salida');
    });
    document.getElementById('select-prov-pedido').addEventListener('change', (e) => {
        document.getElementById('buscador-pedido').value = '';
        generarListaInteractiva(e.target.value, 'lista-pedido-dinamica', 'pedido');
        document.getElementById('btn-imprimir-pedido').style.display = e.target.value ? 'block' : 'none';
    });

    document.body.addEventListener('click', async (e) => {
        
        const btnEditarInsumo = e.target.closest('.btn-editar-insumo');
        if (btnEditarInsumo) {
            const idBuscar = btnEditarInsumo.getAttribute('data-id');
            const insumoEncontrado = insumosGlobal.find(i => i.id == idBuscar);
            
            if (insumoEncontrado) {
                document.getElementById('insumo-id').value = insumoEncontrado.id;
                document.getElementById('insumo-codigo').value = insumoEncontrado.codigo || '';
                document.getElementById('insumo-nombre').value = insumoEncontrado.nombre || '';
                document.getElementById('insumo-unidad').value = insumoEncontrado.unidad_medida || '';
                document.getElementById('insumo-minimo').value = insumoEncontrado.stock_minimo || 0;
                document.getElementById('insumo-inicial').value = insumoEncontrado.cantidad_actual || 0;
                
                // Cargar asignación rápida si existe al menos una
                const asig = asignacionesGlobal.find(a => a.id_insumo == insumoEncontrado.id);
                if (asig) {
                    document.getElementById('insumo-prov-rapido').value = asig.id_proveedor;
                    document.getElementById('insumo-precio-rapido').value = asig.precio || '';
                } else {
                    document.getElementById('insumo-prov-rapido').value = "";
                    document.getElementById('insumo-precio-rapido').value = "";
                }

                document.getElementById('titulo-formulario').innerText = "Editando Insumo";
                document.getElementById('btn-guardar').innerText = "Actualizar Cambios";
                document.getElementById('btn-guardar').classList.replace('btn-primario', 'btn-editar');
                document.getElementById('btn-cancelar').classList.remove('oculto');
                
                document.getElementById('area-scroll').scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        const btnEditarPrecio = e.target.closest('.btn-editar-precio');
        if (btnEditarPrecio) {
            const idAsig = parseInt(btnEditarPrecio.getAttribute('data-id'), 10);
            const precioActual = btnEditarPrecio.getAttribute('data-precio');
            const nuevoPrecio = prompt("Ingrese el nuevo precio (Ej. 15.50):", precioActual);
            
            if (nuevoPrecio !== null && nuevoPrecio.trim() !== "" && !isNaN(parseFloat(nuevoPrecio))) {
                try {
                    const { error } = await db.from('proveedor_insumo').update({ precio: parseFloat(nuevoPrecio) }).eq('id', idAsig);
                    if (error) throw error;
                    cargarDatosMaestros();
                    alert("Precio actualizado exitosamente.");
                } catch (err) {
                    alert("Error al actualizar precio: " + err.message);
                }
            } else if (nuevoPrecio !== null) {
                alert("Por favor ingrese un número válido.");
            }
            return;
        }

        const btnSumar = e.target.closest('.btn-sumar');
        if (btnSumar) {
            const input = btnSumar.previousElementSibling;
            input.value = parseInt(input.value) + 1;
            calcularTotales();
            return;
        }

        const btnRestar = e.target.closest('.btn-restar');
        if (btnRestar) {
            const input = btnRestar.nextElementSibling;
            if (parseInt(input.value) > 0) input.value = parseInt(input.value) - 1;
            calcularTotales();
            return;
        }

        const btnQuitar = e.target.closest('.btn-quitar-asignacion');
        if (btnQuitar) {
            const idAsignacion = parseInt(btnQuitar.getAttribute('data-id'), 10);
            await db.from('proveedor_insumo').delete().eq('id', idAsignacion);
            cargarDatosMaestros();
            return;
        }

        const btnEliminar = e.target.closest('.btn-eliminar');
        if (btnEliminar) {
            if (window.confirm("¿Eliminar este producto permanentemente?")) {
                const { error } = await db.from('insumos').delete().eq('id', parseInt(btnEliminar.getAttribute('data-id'), 10));
                if(error) alert("No puedes eliminar un producto si aún está asignado a un proveedor. Quítalo del proveedor primero.");
                cargarDatosMaestros();
            }
            return;
        }

        const btnEditarProv = e.target.closest('.btn-editar-prov');
        if (btnEditarProv) {
            const idBuscarProv = btnEditarProv.getAttribute('data-id');
            const provEncontrado = proveedoresGlobal.find(p => p.id == idBuscarProv);
            
            if (provEncontrado) {
                document.getElementById('prov-id').value = provEncontrado.id;
                document.getElementById('prov-nombre').value = provEncontrado.nombre || '';
                document.getElementById('prov-telefono').value = provEncontrado.telefono || '';
                
                document.getElementById('titulo-form-proveedor').innerText = "Editando Proveedor";
                document.getElementById('btn-guardar-prov').innerText = "Actualizar Cambios";
                document.getElementById('btn-guardar-prov').classList.replace('btn-primario', 'btn-editar');
                document.getElementById('btn-cancelar-prov').classList.remove('oculto');
                
                document.getElementById('area-scroll').scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        const btnEliminarProv = e.target.closest('.btn-eliminar-prov');
        if (btnEliminarProv) {
            if (window.confirm("¿Estás seguro de eliminar este proveedor?")) {
                await db.from('proveedores').delete().eq('id', parseInt(btnEliminarProv.getAttribute('data-id'), 10));
                cargarDatosMaestros();
            }
            return;
        }
    });
});

window.cancelarEdicion = function() {
    document.getElementById('form-insumo').reset();
    document.getElementById('insumo-id').value = "";
    document.getElementById('insumo-codigo').value = ""; 
    document.getElementById('insumo-prov-rapido').value = ""; 
    document.getElementById('insumo-precio-rapido').value = ""; 
    document.getElementById('titulo-formulario').innerText = "Agregar Nuevo Insumo";
    document.getElementById('btn-guardar').innerText = "Guardar Insumo";
    document.getElementById('btn-guardar').classList.replace('btn-editar', 'btn-primario');
    document.getElementById('btn-cancelar').classList.add('oculto');
}

window.cancelarEdicionProv = function() {
    document.getElementById('form-proveedor').reset();
    document.getElementById('prov-id').value = "";
    document.getElementById('titulo-form-proveedor').innerText = "Agregar Nuevo Proveedor";
    document.getElementById('btn-guardar-prov').innerText = "Guardar Proveedor";
    document.getElementById('btn-guardar-prov').classList.replace('btn-editar', 'btn-primario');
    document.getElementById('btn-cancelar-prov').classList.add('oculto');
}

window.imprimirPedidoManual = function() {
    const provNombre = document.getElementById('select-prov-pedido').options[document.getElementById('select-prov-pedido').selectedIndex].text;
    const inputs = document.querySelectorAll('#lista-pedido-dinamica .input-cant');
    
    let htmlTabla = '';
    let hayItems = false;
    let granTotal = 0;

    inputs.forEach(input => {
        const cantidad = parseInt(input.value);
        if(cantidad > 0) {
            hayItems = true;
            const idProducto = input.id.split('-')[2]; 
            const prodInfo = insumosGlobal.find(i => i.id == idProducto);
            const precioUnitario = parseFloat(input.getAttribute('data-precio')) || 0;
            const subtotal = cantidad * precioUnitario;
            granTotal += subtotal;
            
            const codigoTexto = prodInfo.codigo ? `[${prodInfo.codigo}] ` : '';
            
            htmlTabla += `
                <tr>
                    <td>${codigoTexto}${prodInfo.nombre}</td>
                    <td style="text-align:center;"><strong>${cantidad} ${prodInfo.unidad_medida}</strong></td>
                    <td style="text-align:right;">Q${precioUnitario.toFixed(2)}</td>
                    <td style="text-align:right;"><strong>Q${subtotal.toFixed(2)}</strong></td>
                </tr>`;
        }
    });

    if(!hayItems) {
        alert("No has puesto ninguna cantidad para pedir.");
        return;
    }

    abrirVentanaImpresion(`
        <h1>Orden de Compra</h1>
        <h3>Proveedor: ${provNombre}</h3>
        <p>Fecha: ${new Date().toLocaleDateString()}</p>
        <hr>
        <table style="width:100%; border-collapse: collapse; text-align: left;" border="1" cellpadding="8">
            <tr style="background-color: #f4f4f4;">
                <th>Producto a Comprar</th>
                <th style="text-align:center;">Cantidad</th>
                <th style="text-align:right;">Precio Unit.</th>
                <th style="text-align:right;">Subtotal</th>
            </tr>
            ${htmlTabla}
            <tr>
                <td colspan="3" style="text-align: right; font-weight: bold; font-size: 1.2em;">GRAN TOTAL:</td>
                <td style="text-align: right; font-weight: bold; font-size: 1.2em; color: green;">Q${granTotal.toFixed(2)}</td>
            </tr>
        </table>
    `);
}

window.imprimirReporteAutomatico = function() {
    let contenido = `<h1>Reporte Automático de Faltantes</h1>
                     <p>Generado el: ${new Date().toLocaleDateString()}</p><hr>`;
    let hayCompras = false;

    proveedoresGlobal.forEach(prov => {
        const susAsig = asignacionesGlobal.filter(a => a.id_proveedor == prov.id);
        let productosNecesitados = [];

        susAsig.forEach(asig => {
            const insumo = insumosGlobal.find(i => i.id == asig.id_insumo);
            if(insumo && parseFloat(insumo.cantidad_actual) <= parseFloat(insumo.stock_minimo)) {
                productosNecesitados.push(insumo);
            }
        });

        if (productosNecesitados.length > 0) {
            hayCompras = true;
            contenido += `<h3>Proveedor: ${prov.nombre} <br><small>Tel: ${prov.telefono}</small></h3>
                <table style="width:100%; border-collapse:collapse; text-align:left;" border="1" cellpadding="8">
                    <tr style="background-color:#f4f4f4;"><th>Código</th><th>Producto</th><th>Bodega</th><th>Mínimo</th></tr>`;
            productosNecesitados.forEach(prod => {
                const codigoTexto = prod.codigo ? prod.codigo : '---';
                contenido += `<tr>
                    <td>${codigoTexto}</td>
                    <td>${prod.nombre}</td>
                    <td style="color:red; font-weight:bold;">${prod.cantidad_actual} ${prod.unidad_medida}</td>
                    <td>${prod.stock_minimo} ${prod.unidad_medida}</td>
                </tr>`;
            });
            contenido += `</table><br>`;
        }
    });

    if(!hayCompras) contenido += `<p style="color: green;">El stock está en niveles óptimos.</p>`;
    abrirVentanaImpresion(contenido);
}

function abrirVentanaImpresion(htmlContenido) {
    const ventana = window.open('', '_blank', 'width=800,height=600');
    ventana.document.write(`
        <html><head><title>Imprimir Documento</title>
        <style>body{font-family: Arial, sans-serif; padding: 20px;} th, td { border-bottom: 1px solid #ddd; }</style>
        </head><body>${htmlContenido}</body></html>
    `);
    ventana.document.close();
    setTimeout(() => ventana.print(), 500);
}