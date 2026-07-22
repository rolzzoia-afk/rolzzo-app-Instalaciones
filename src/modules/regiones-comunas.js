import { escapeHtml } from './evaluaciones.js';
import { g } from './form-helpers.js';

/* ===== Regiones y comunas de Chile ===== */
export const REGIONES_COMUNAS=[
  {label:'RM - Región Metropolitana',comunas:['Santiago','Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura','Quinta Normal','Recoleta','Renca','San Joaquín','San Miguel','San Ramón','Vitacura','Puente Alto','Pirque','San José de Maipo','Colina','Lampa','Til Til','San Bernardo','Buin','Calera de Tango','Paine','Melipilla','Alhué','Curacaví','María Pinto','San Pedro','Talagante','El Monte','Isla de Maipo','Padre Hurtado','Peñaflor']},
  {label:'1ª - Región de Tarapacá',comunas:['Iquique','Alto Hospicio','Pozo Almonte','Camiña','Colchane','Huara','Pica']},
  {label:'2ª - Región de Antofagasta',comunas:['Antofagasta','Mejillones','Sierra Gorda','Taltal','Calama','Ollagüe','San Pedro de Atacama','Tocopilla','María Elena']},
  {label:'3ª - Región de Atacama',comunas:['Copiapó','Caldera','Tierra Amarilla','Chañaral','Diego de Almagro','Vallenar','Alto del Carmen','Freirina','Huasco']},
  {label:'4ª - Región de Coquimbo',comunas:['La Serena','Coquimbo','Andacollo','La Higuera','Paihuano','Vicuña','Illapel','Canela','Los Vilos','Salamanca','Ovalle','Combarbalá','Monte Patria','Punitaqui','Río Hurtado']},
  {label:'5ª - Región de Valparaíso',comunas:['Valparaíso','Casablanca','Concón','Juan Fernández','Puchuncaví','Quintero','Viña del Mar','Isla de Pascua','Los Andes','Calle Larga','Rinconada','San Esteban','Quillota','La Cruz','La Calera','Nogales','Hijuelas','San Antonio','Algarrobo','Cartagena','El Quisco','El Tabo','Santo Domingo','San Felipe','Catemu','Llaillay','Panquehue','Putaendo','Santa María','Quilpué','Limache','Olmué','Villa Alemana']},
  {label:'6ª - Región del Libertador Bernardo O\'Higgins',comunas:['Rancagua','Codegua','Coinco','Coltauco','Doñihue','Graneros','Las Cabras','Machalí','Malloa','Mostazal','Olivar','Peumo','Pichidegua','Quinta de Tilcoco','Rengo','Requínoa','San Vicente','Pichilemu','La Estrella','Litueche','Marchihue','Navidad','Paredones','San Fernando','Chépica','Chimbarongo','Lolol','Nancagua','Palmilla','Peralillo','Placilla','Pumanque','Santa Cruz']},
  {label:'7ª - Región del Maule',comunas:['Talca','Constitución','Curepto','Empedrado','Maule','Pelarco','Pencahue','Río Claro','San Clemente','San Rafael','Cauquenes','Chanco','Pelluhue','Curicó','Hualañé','Licantén','Molina','Rauco','Romeral','Sagrada Familia','Teno','Vichuquén','Linares','Colbún','Longaví','Parral','Retiro','San Javier','Villa Alegre','Yerbas Buenas']},
  {label:'8ª - Región del Biobío',comunas:['Concepción','Coronel','Chiguayante','Florida','Hualqui','Lota','Penco','San Pedro de la Paz','Santa Juana','Talcahuano','Tomé','Hualpén','Lebu','Arauco','Cañete','Contulmo','Curanilahue','Los Álamos','Tirúa','Los Ángeles','Antuco','Cabrero','Laja','Mulchén','Nacimiento','Negrete','Quilaco','Quilleco','San Rosendo','Santa Bárbara','Tucapel','Yumbel','Alto Biobío']},
  {label:'9ª - Región de La Araucanía',comunas:['Temuco','Carahue','Cunco','Curarrehue','Freire','Galvarino','Gorbea','Lautaro','Loncoche','Melipeuco','Nueva Imperial','Padre Las Casas','Perquenco','Pitrufquén','Pucón','Saavedra','Teodoro Schmidt','Toltén','Vilcún','Villarrica','Cholchol','Angol','Collipulli','Curacautín','Ercilla','Lonquimay','Los Sauces','Lumaco','Purén','Renaico','Traiguén','Victoria']},
  {label:'10ª - Región de Los Lagos',comunas:['Puerto Montt','Calbuco','Cochamó','Fresia','Frutillar','Los Muermos','Llanquihue','Maullín','Puerto Varas','Castro','Ancud','Chonchi','Curaco de Vélez','Dalcahue','Puqueldón','Queilén','Quellón','Quemchi','Quinchao','Osorno','Puerto Octay','Purranque','Puyehue','Río Negro','San Juan de la Costa','San Pablo','Chaitén','Futaleufú','Hualaihué','Palena']},
  {label:'11ª - Región de Aysén',comunas:['Coyhaique','Lago Verde','Aysén','Cisnes','Guaitecas','Cochrane','O\'Higgins','Tortel','Chile Chico','Río Ibáñez']},
  {label:'12ª - Región de Magallanes y la Antártica Chilena',comunas:['Punta Arenas','Laguna Blanca','Río Verde','San Gregorio','Cabo de Hornos','Antártica','Porvenir','Primavera','Timaukel','Natales','Torres del Paine']},
  {label:'14ª - Región de Los Ríos',comunas:['Valdivia','Corral','Lanco','Los Lagos','Máfil','Mariquina','Paillaco','Panguipulli','La Unión','Futrono','Lago Ranco','Río Bueno']},
  {label:'15ª - Región de Arica y Parinacota',comunas:['Arica','Camarones','Putre','General Lagos']},
  {label:'16ª - Región de Ñuble',comunas:['Chillán','Bulnes','Chillán Viejo','El Carmen','Pemuco','Pinto','Quillón','San Ignacio','Yungay','Cobquecura','Coelemu','Ninhue','Portezuelo','Quirihue','Ránquil','Treguaco','San Carlos','Coihueco','Ñiquén','San Fabián','San Nicolás']}
];
export function populateRegiones(selId){
  const el=g(selId);if(!el)return;
  el.innerHTML='<option value="">Seleccionar...</option>'+REGIONES_COMUNAS.map(r=>`<option value="${escapeHtml(r.label)}">${escapeHtml(r.label)}</option>`).join('');
}
export function populateComunasForRegion(regSelId,comunaSelId,keepValue){
  const regEl=g(regSelId),comEl=g(comunaSelId);if(!regEl||!comEl)return;
  const region=REGIONES_COMUNAS.find(r=>r.label===regEl.value);
  if(!region){comEl.innerHTML='<option value="">Elige una región primero...</option>';comEl.disabled=true;return;}
  comEl.disabled=false;
  comEl.innerHTML='<option value="">Seleccionar...</option>'+region.comunas.map(c=>`<option value="${escapeHtml(c)}" ${c===keepValue?'selected':''}>${escapeHtml(c)}</option>`).join('');
}
/* Ubica y selecciona región+comuna a partir de un nombre de comuna guardado (para edición) */
export function setRegionComunaFromComuna(regSelId,comunaSelId,comunaVal){
  if(!comunaVal)return;
  const region=REGIONES_COMUNAS.find(r=>r.comunas.includes(comunaVal));
  if(!region)return;
  g(regSelId).value=region.label;
  populateComunasForRegion(regSelId,comunaSelId,comunaVal);
}
