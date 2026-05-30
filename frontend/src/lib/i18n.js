const COMMON = {
  es: {
    loading:'Cargando...', noRecords:'Sin registros', retry:'Reintentar',
    save:'Guardar', cancel:'Cancelar', edit:'Editar', delete:'Eliminar',
    new:'Nuevo', search:'Buscar', clear:'Limpiar',
    prev:'← Anterior', next:'Siguiente →', page:'Página', of:'de',
    noGroup:'Sin grupo', noService:'Sin culto', noContact:'Sin contacto',
    close:'Cerrar', back:'← Volver', all:'Todos',
    name:'Nombre', phone:'Teléfono', status:'Estado', date:'Fecha',
    description:'Descripción', leader:'Líder', actions:'Acciones',
    noData:'Sin datos', notAssigned:'Sin asignar',
  },
  pt: {
    loading:'Carregando...', noRecords:'Sem registros', retry:'Tentar novamente',
    save:'Salvar', cancel:'Cancelar', edit:'Editar', delete:'Excluir',
    new:'Novo', search:'Buscar', clear:'Limpar',
    prev:'← Anterior', next:'Próximo →', page:'Página', of:'de',
    noGroup:'Sem grupo', noService:'Sem culto', noContact:'Sem contato',
    close:'Fechar', back:'← Voltar', all:'Todos',
    name:'Nome', phone:'Telefone', status:'Estado', date:'Data',
    description:'Descrição', leader:'Líder', actions:'Ações',
    noData:'Sem dados', notAssigned:'Sem atribuição',
  },
  en: {
    loading:'Loading...', noRecords:'No records', retry:'Retry',
    save:'Save', cancel:'Cancel', edit:'Edit', delete:'Delete',
    new:'New', search:'Search', clear:'Clear',
    prev:'← Previous', next:'Next →', page:'Page', of:'of',
    noGroup:'No group', noService:'No service', noContact:'No contact',
    close:'Close', back:'← Back', all:'All',
    name:'Name', phone:'Phone', status:'Status', date:'Date',
    description:'Description', leader:'Leader', actions:'Actions',
    noData:'No data', notAssigned:'Not assigned',
  },
}

export function getLang() {
  return (localStorage.getItem('church_lang') || 'es').slice(0, 2)
}

export function makeI18n(pageDef = {}) {
  const lang = getLang()
  const common = COMMON[lang] || COMMON.es
  const page = pageDef[lang] || pageDef.es || {}
  const merged = { ...common, ...page }
  const fallback = { ...COMMON.es, ...(pageDef.es || {}) }
  return key => (key in merged ? merged[key] : (key in fallback ? fallback[key] : key))
}
