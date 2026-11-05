// Shared validation for Black Raven's private SMTP relay.
export function validateEnquiry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Invalid request' };
  const strings = {};
  for (const field of ['name', 'email', 'programme', 'topic', 'message', '_gotcha']) {
    if (data[field] !== undefined && typeof data[field] !== 'string') return { error: 'Invalid field' };
    strings[field] = (data[field] || '').trim();
  }
  const { name, email, programme, topic, message } = strings;
  if (strings._gotcha) return { spam: true };
  if (name.length < 2 || name.length > 120) return { error: 'Invalid name' };
  if (email.length < 5 || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return { error: 'Invalid email' };
  if (message.length < 10 || message.length > 5000) return { error: 'Invalid message' };
  if (programme.length > 80 || topic.length > 160) return { error: 'Invalid optional fields' };
  if (Object.values(strings).some(value => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))) return { error: 'Invalid control characters' };
  return { value: { name, email, programme, topic, message } };
}

export function formatEmailText(v) {
  return [
    'Novo povpraševanje s spletne strani Black Raven Solutions',
    '',
    'Ime: ' + v.name,
    'E-pošta obiskovalca: ' + v.email,
    'Program: ' + (v.programme || 'Ni izbran'),
    'Tema: ' + (v.topic || 'Splošno povpraševanje'),
    '',
    'Sporočilo:',
    v.message,
    '',
    'Odgovori na sporočilo z uporabo Reply-To.'
  ].join('\n');
}

export function allowedOrigins(raw) {
  return new Set((raw || '').split(',').map(value => value.trim()).filter(value => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value)));
}
