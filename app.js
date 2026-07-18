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
        const resAsig = await db.from('proveedor_insumo').select('id, id_proveedor, id_insumo');

        insumosGlobal = resInsumos.data || [];
        proveedoresGlobal = resProv.data || [];
        asignacionesGlobal = resAsig.data || [];

        renderizarInsumos();
        renderizarProveedores();
        renderizarCatalogoProveedores();
        
        document.getElementById('select-prov-entrada').dispatchEvent(new Event('change'));
        document.getElementById('select-prov-salida').dispatchEvent(new Event('change'));
        document.getElementById('select-prov-pedido').dispatchEvent(new Event('change'));
    } catch (error) {
        console.error("Error cargando datos:", error.message);
    }
}

function renderizarInsumos() {
    const tbody = document.getElementById('tabla-insumos-body');
    const selectInsumoAsignar = document.getElementById('select-insumo-asignar');
    const contenedorAlertas = document.getElementById('contenedor-alertas');
    
    tbody.innerHTML = '';
    selectInsumoAsignar.innerHTML = '<option value="">Seleccionar Producto...</option>';
    if(contenedorAlertas) contenedorAlertas.innerHTML = ''; 

    insumosGlobal.forEach(insumo => {
        const stockActual = parseFloat(insumo.cantidad_actual);
        const stockMinimo = parseFloat(insumo.stock_minimo);
        let colorStock = 'color: var(--verde); font-weight: bold;';
        
        if (stockActual <= stockMinimo) {
            colorStock = 'color: var(--rojo-texto); font-weight: bold;';
            if(contenedorAlertas) {
                const divAlerta = document.createElement('div');
                divAlerta.className = 'alerta alerta-peligro';
                divAlerta.innerHTML = `<p><strong>¡Alerta!</strong> ${insumo.nombre} (Quedan: ${stockActual} ${insumo.unidad_medida}).</p>`;
                contenedorAlertas.appendChild(divAlerta);
            }
        }

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--borde);">
                <td style="padding: 10px;">${insumo.id}</td>
                <td style="padding: 10px;">${insumo.nombre}</td>
                <td style="padding: 10px;">${insumo.unidad_medida}</td>
                <td style="padding: 10px;">${insumo.stock_minimo}</td>
                <td style="padding: 10px;"><span style="${colorStock}">${insumo.cantidad_actual}</span></td>
                <td style="padding: 10px; text-align: center;">
                    <button class="btn btn-editar" data-id="${insumo.id}" data-nombre="${insumo.nombre}" data-unidad="${insumo.unidad_medida}" data-minimo="${insumo.stock_minimo}" data-actual="${insumo.cantidad_actual}" style="background-color: var(--naranja); color: white; padding: 5px 10px; margin-right: 5px;">✏️</button>
                    <button class="btn btn-peligro btn-eliminar" data-id="${insumo.id}" style="padding: 5px 10px;">🗑️</button>
                </td>
            </tr>
        `;
        selectInsumoAsignar.innerHTML += `<option value="${insumo.id}">${insumo.nombre}</option>`;
    });
}

function renderizarProveedores() {
    const selects = ['select-prov-asignar', 'select-prov-entrada', 'select-prov-pedido'];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        const placeholder = select.options[0].text;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        proveedoresGlobal.forEach(prov => {
            select.innerHTML += `<option value="${prov.id}">${prov.nombre}</option>`;
        });
    });

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
                    htmlProductos += `
                        <li style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ccc;">
                            <span>📦 ${insumoReal.nombre}</span>
                            <button class="btn btn-peligro btn-quitar-asignacion" data-id="${asig.id}" style="padding: 2px 8px; font-size: 0.8em;">Quitar</button>
                        </li>`;
                }
            });
            htmlProductos += '</ul>';
        }

        contenedor.innerHTML += `
            <div style="border: 1px solid var(--borde); padding: 15px; border-radius: 5px; margin-bottom: 15px; background: #f9fafb;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0; color: var(--azul); font-size: 1.2rem;">${prov.nombre}</h4>
                        <span style="display: inline-block; margin-top: 5px; background: #e5e7eb; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #374151;">📞 Tel: ${prov.telefono}</span>
                    </div>
                    <div>
                        <button class="btn btn-editar-prov" data-id="${prov.id}" data-nombre="${prov.nombre}" data-telefono="${prov.telefono}" style="background-color: var(--naranja); color: white; padding: 5px 10px; margin-right: 5px;">✏️ Editar</button>
                        <button class="btn btn-eliminar-prov" data-id="${prov.id}" style="background-color: #ef4444; color: white; padding: 5px 10px; border: none;">🗑️</button>
                    </div>
                </div>
                ${htmlProductos}
            </div>
        `;
    });
}

function generarListaInteractiva(idProv, contenedorId, tipo) {
    const contenedor = document.getElementById(contenedorId);
    contenedor.innerHTML = '';
    
    if(!idProv) return;

    let productos = [];
    if (idProv === 'todos') {
        productos = insumosGlobal;
    } else {
        const asignaciones = asignacionesGlobal.filter(a => a.id_proveedor == idProv);
        productos = asignaciones.map(a => insumosGlobal.find(i => i.id == a.id_insumo)).filter(i => i);
    }

    if(productos.length === 0) {
        contenedor.innerHTML = '<p style="color: gray;">No hay productos para mostrar.</p>';
        return;
    }

    productos.forEach(prod => {
        let btnAccion = '';
        if(tipo === 'entrada') {
            btnAccion = `<button class="btn btn-exito btn-procesar" data-id="${prod.id}" data-tipo="entrada" data-stock="${prod.cantidad_actual}" data-unidad="${prod.unidad_medida}" style="padding: 8px;">📥 Ingresar</button>`;
        } else if (tipo === 'salida') {
            btnAccion = `<button class="btn btn-peligro btn-procesar" data-id="${prod.id}" data-tipo="salida" data-stock="${prod.cantidad_actual}" data-unidad="${prod.unidad_medida}" style="padding: 8px;">📤 Descontar</button>`;
        }

        contenedor.innerHTML += `
            <div class="item-lista">
                <div style="flex: 1;">
                    <strong>${prod.nombre}</strong><br>
                    <small style="color: gray;">Bodega: ${prod.cantidad_actual} ${prod.unidad_medida}</small>
                </div>
                <div class="control-cantidad" style="margin-right: 15px;">
                    <button class="btn-circulo btn-restar">-</button>
                    <input type="number" class="input-cant cant-input" id="input-${tipo}-${prod.id}" value="0" min="0">
                    <button class="btn-circulo btn-sumar">+</button>
                </div>
                ${btnAccion}
            </div>
        `;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosMaestros();

    document.querySelectorAll('.btn-nav').forEach(boton => {
        boton.addEventListener('click', () => {
            document.querySelectorAll('.btn-nav, .modulo').forEach(el => el.classList.remove('activo'));
            boton.classList.add('activo');
            document.getElementById(`modulo-${boton.getAttribute('data-modulo')}`).classList.add('activo');
        });
    });

    document.getElementById('form-insumo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicion = document.getElementById('insumo-id').value;
        const nombre = document.getElementById('insumo-nombre').value;
        const unidad = document.getElementById('insumo-unidad').value;
        const stockMinimo = document.getElementById('insumo-minimo').value;
        const stockActual = document.getElementById('insumo-inicial').value;

        try {
            if (idEdicion === "") {
                await db.from('insumos').insert([{ nombre, unidad_medida: unidad, stock_minimo: stockMinimo, cantidad_actual: stockActual }]);
            } else {
                await db.from('insumos').update({ nombre, unidad_medida: unidad, stock_minimo: stockMinimo, cantidad_actual: stockActual }).eq('id', idEdicion);
            }
            cancelarEdicion();
            cargarDatosMaestros(); 
            alert("Producto guardado exitosamente.");
        } catch (error) { alert("Error al guardar producto."); }
    });

    document.getElementById('form-proveedor').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idProv = document.getElementById('prov-id').value;
        const nombre = document.getElementById('prov-nombre').value;
        const telefono = document.getElementById('prov-telefono').value;
        
        try {
            if(idProv === "") {
                await db.from('proveedores').insert([{ nombre, telefono }]);
                alert("Proveedor guardado exitosamente.");
            } else {
                await db.from('proveedores').update({ nombre, telefono }).eq('id', idProv);
                alert("Proveedor actualizado exitosamente.");
            }
            cancelarEdicionProv();
            cargarDatosMaestros();
        } catch (error) { alert("Error al guardar proveedor."); }
    });

    // --- CORRECCIÓN CLAVE AQUÍ: Atrapar errores al asignar productos ---
    document.getElementById('form-asignacion').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idProv = document.getElementById('select-prov-asignar').value;
        const idIns = document.getElementById('select-insumo-asignar').value;
        
        try {
            const { error } = await db.from('proveedor_insumo').insert([{ id_proveedor: idProv, id_insumo: idIns }]);
            
            if (error) {
                console.error("Error devuelto por Supabase:", error);
                throw error;
            }

            document.getElementById('form-asignacion').reset();
            cargarDatosMaestros();
            alert("✅ Producto asignado correctamente al proveedor.");
        } catch (error) { 
            console.error("Error al asignar:", error);
            alert("Error al vincular el producto. \n\nPosibles causas:\n1. El producto ya está asignado a este proveedor.\n2. Falta ejecutar el código SQL para crear la tabla 'proveedor_insumo' en Supabase."); 
        }
    });

    document.getElementById('select-prov-entrada').addEventListener('change', (e) => generarListaInteractiva(e.target.value, 'lista-entrada-dinamica', 'entrada'));
    document.getElementById('select-prov-salida').addEventListener('change', (e) => generarListaInteractiva(e.target.value, 'lista-salida-dinamica', 'salida'));
    document.getElementById('select-prov-pedido').addEventListener('change', (e) => {
        generarListaInteractiva(e.target.value, 'lista-pedido-dinamica', 'pedido');
        document.getElementById('btn-imprimir-pedido').style.display = e.target.value ? 'block' : 'none';
    });

    document.body.addEventListener('click', async (e) => {
        const boton = e.target;
        
        if (boton.classList.contains('btn-sumar')) {
            const input = boton.previousElementSibling;
            input.value = parseInt(input.value) + 1;
        }
        if (boton.classList.contains('btn-restar')) {
            const input = boton.nextElementSibling;
            if (parseInt(input.value) > 0) input.value = parseInt(input.value) - 1;
        }

        if (boton.classList.contains('btn-procesar')) {
            const id = boton.getAttribute('data-id');
            const tipo = boton.getAttribute('data-tipo');
            const stockActual = parseFloat(boton.getAttribute('data-stock'));
            const unidad = boton.getAttribute('data-unidad');
            const inputElement = document.getElementById(`input-${tipo}-${id}`);
            const cantidadModificar = parseFloat(inputElement.value);

            if (cantidadModificar > 0) {
                const nuevoStock = tipo === 'entrada' ? stockActual + cantidadModificar : stockActual - cantidadModificar;
                try {
                    await db.from('insumos').update({ cantidad_actual: nuevoStock }).eq('id', id);
                    inputElement.value = 0; 
                    cargarDatosMaestros(); 
                    const accionText = tipo === 'entrada' ? 'Ingresaron' : 'Se descontaron';
                    alert(`✅ ¡Hecho! ${accionText} ${cantidadModificar} ${unidad}.`);
                } catch (error) { alert("Error al procesar en la base de datos."); }
            } else {
                alert("La cantidad debe ser mayor a 0.");
            }
        }

        if (boton.classList.contains('btn-quitar-asignacion')) {
            const idAsignacion = boton.getAttribute('data-id');
            await db.from('proveedor_insumo').delete().eq('id', idAsignacion);
            cargarDatosMaestros();
        }

        if (boton.classList.contains('btn-editar')) {
            document.getElementById('insumo-id').value = boton.getAttribute('data-id');
            document.getElementById('insumo-nombre').value = boton.getAttribute('data-nombre');
            document.getElementById('insumo-unidad').value = boton.getAttribute('data-unidad');
            document.getElementById('insumo-minimo').value = boton.getAttribute('data-minimo');
            document.getElementById('insumo-inicial').value = boton.getAttribute('data-actual');
            
            document.getElementById('titulo-formulario').innerText = "✏️ Editando Insumo";
            document.getElementById('btn-guardar').innerText = "Actualizar Cambios";
            document.getElementById('btn-guardar').classList.replace('btn-primario', 'btn-editar');
            document.getElementById('btn-cancelar').classList.remove('oculto');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (boton.classList.contains('btn-eliminar')) {
            if (window.confirm("¿Eliminar este producto permanentemente?")) {
                await db.from('insumos').delete().eq('id', boton.getAttribute('data-id'));
                cargarDatosMaestros();
            }
        }

        if (boton.classList.contains('btn-editar-prov')) {
            document.getElementById('prov-id').value = boton.getAttribute('data-id');
            document.getElementById('prov-nombre').value = boton.getAttribute('data-nombre');
            document.getElementById('prov-telefono').value = boton.getAttribute('data-telefono');
            
            document.getElementById('titulo-form-proveedor').innerText = "✏️ Editando Proveedor";
            document.getElementById('btn-guardar-prov').innerText = "Actualizar Cambios";
            document.getElementById('btn-guardar-prov').classList.replace('btn-primario', 'btn-editar');
            document.getElementById('btn-cancelar-prov').classList.remove('oculto');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (boton.classList.contains('btn-eliminar-prov')) {
            if (window.confirm("¿Estás seguro de eliminar este proveedor? Sus productos asociados se desvincularán automáticamente.")) {
                await db.from('proveedores').delete().eq('id', boton.getAttribute('data-id'));
                cargarDatosMaestros();
            }
        }
    });
});

window.cancelarEdicion = function() {
    document.getElementById('form-insumo').reset();
    document.getElementById('insumo-id').value = "";
    document.getElementById('titulo-formulario').innerText = "🛒 Agregar Nuevo Insumo";
    document.getElementById('btn-guardar').innerText = "Guardar Insumo";
    document.getElementById('btn-guardar').classList.replace('btn-editar', 'btn-primario');
    document.getElementById('btn-cancelar').classList.add('oculto');
}

window.cancelarEdicionProv = function() {
    document.getElementById('form-proveedor').reset();
    document.getElementById('prov-id').value = "";
    document.getElementById('titulo-form-proveedor').innerText = "🤝 Agregar Nuevo Proveedor";
    document.getElementById('btn-guardar-prov').innerText = "Guardar Proveedor";
    document.getElementById('btn-guardar-prov').classList.replace('btn-editar', 'btn-primario');
    document.getElementById('btn-cancelar-prov').classList.add('oculto');
}

window.imprimirPedidoManual = function() {
    const provNombre = document.getElementById('select-prov-pedido').options[document.getElementById('select-prov-pedido').selectedIndex].text;
    const inputs = document.querySelectorAll('#lista-pedido-dinamica .input-cant');
    
    let htmlTabla = '';
    let hayItems = false;

    inputs.forEach(input => {
        const cantidad = parseInt(input.value);
        if(cantidad > 0) {
            hayItems = true;
            const idProducto = input.id.split('-')[2]; 
            const prodInfo = insumosGlobal.find(i => i.id == idProducto);
            
            htmlTabla += `
                <tr>
                    <td>${prodInfo.nombre}</td>
                    <td><strong>${cantidad} ${prodInfo.unidad_medida}</strong></td>
                </tr>`;
        }
    });

    if(!hayItems) {
        alert("No has puesto ninguna cantidad para pedir. Usa los botones + o escribe un número.");
        return;
    }

    abrirVentanaImpresion(`
        <h1>Orden de Compra</h1>
        <h3>Proveedor: ${provNombre}</h3>
        <p>Fecha: ${new Date().toLocaleDateString()}</p>
        <hr>
        <table style="width:100%; border-collapse: collapse; text-align: left;" border="1" cellpadding="8">
            <tr style="background-color: #f4f4f4;"><th>Producto a Comprar</th><th>Cantidad Solicitada</th></tr>
            ${htmlTabla}
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
            contenido += `<h3>📦 Proveedor: ${prov.nombre} <br><small>📞 Tel: ${prov.telefono}</small></h3>
                <table style="width:100%; border-collapse:collapse; text-align:left;" border="1" cellpadding="8">
                    <tr style="background-color:#f4f4f4;"><th>Producto</th><th>Bodega</th><th>Mínimo</th></tr>`;
            productosNecesitados.forEach(prod => {
                contenido += `<tr>
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