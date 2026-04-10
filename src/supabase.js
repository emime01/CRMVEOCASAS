const URL = 'https://nrpgykebktypuvidovsz.supabase.co/rest/v1'
const KEY = 'sb_publishable_GphjR_dNdLY77M92KY4D5w_Hajfdiaq'

const headers = {
  'Content-Type': 'application/json',
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Prefer': 'return=representation'
}

export const supabase = {
  from: (table) => ({
    select: (cols = '*') => ({
      order: (col, opts = {}) => fetch(
        `${URL}/${table}?select=${cols}&order=${col}.${opts.ascending===false?'desc':'asc'}`,
        { headers }
      ).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data : [], error: null })),
      eq: (col, val) => fetch(
        `${URL}/${table}?select=${cols}&${col}=eq.${val}`,
        { headers }
      ).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data : [], error: null })),
      then: (fn) => fetch(
        `${URL}/${table}?select=${cols}`,
        { headers }
      ).then(r => r.json()).then(data => fn({ data: Array.isArray(data) ? data : [], error: null }))
    }),
    insert: (rows) => ({
      select: () => ({
        single: () => fetch(`${URL}/${table}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(rows[0])
        }).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data[0] : data, error: null }))
      })
    }),
    update: (changes) => ({
      eq: (col, val) => ({
        select: () => ({
          single: () => fetch(`${URL}/${table}?${col}=eq.${val}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(changes)
          }).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data[0] : data, error: null }))
        }),
        then: (fn) => fetch(`${URL}/${table}?${col}=eq.${val}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(changes)
        }).then(r => r.json()).then(data => fn({ data, error: null }))
      })
    }),
    upsert: (rows, opts = {}) => ({
      select: () => ({
        single: () => fetch(`${URL}/${table}`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': `resolution=merge-duplicates,return=representation` },
          body: JSON.stringify(rows[0])
        }).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data[0] : data, error: null }))
      })
    }),
    delete: () => ({
      eq: (col, val) => fetch(`${URL}/${table}?${col}=eq.${val}`, {
        method: 'DELETE',
        headers
      }).then(() => ({ error: null }))
    })
  })
}
