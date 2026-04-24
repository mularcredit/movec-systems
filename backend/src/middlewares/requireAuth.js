const supabase = require('../utils/supabase');

/**
 * Middleware: requireAuth
 * 
 * 1. Checks Header: `Authorization: Bearer <token>`
 * 2. Uses Supabase Admin Client to cryptographically verify token via `getUser()`
 * 3. Extracts mapping `tenant_id` from the profiles table.
 * 4. Injects `req.user` and `req.tenant_id` downstream for explicit Controller filtering.
 */
module.exports = async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Authenticate the user token securely via Supabase Auth server.
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid or expired authentication token' });
        }

        // Cross-reference the verified UUID against our profile registry to map the logical isolated Tenant.
        // The service_role key allows us internal DB lookups safely.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, tenant_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ error: 'Authenticated user possesses no operational profile identity.' });
        }

        if (!profile.tenant_id) {
            return res.status(403).json({ error: 'MULTI-TENANCY SECURITY LOCK: User is not linked to an operational Tenant (Company).' });
        }

        // Safely map isolated properties onto HTTP Request lifecycle scope 
        req.user = user;
        req.tenant_id = profile.tenant_id;
        
        next();

    } catch (e) {
        return res.status(500).json({ error: 'Internal Server Error enforcing multi-tenancy auth checks.' });
    }
};
