// Valida `req[source]` y deja el resultado en `req.valid`
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.valid = result.data;
    next();
  };
}

// Sin `limit` devuelve todo. El total siempre viaja en X-Total-Count.
function sendPage(res, items, { limit, offset = 0 }) {
  res.set('X-Total-Count', String(items.length));
  res.json(limit === undefined && offset === 0 ? items : items.slice(offset, limit === undefined ? undefined : offset + limit));
}

// `to` sin hora incluye el día completo
function inDateRange(value, from, to) {
  if (!from && !to) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (from && time < new Date(from).getTime()) return false;
  if (to) {
    const end = to.length === 10 ? `${to}T23:59:59.999` : to;
    if (time > new Date(end).getTime()) return false;
  }
  return true;
}

module.exports = { validate, sendPage, inDateRange };
