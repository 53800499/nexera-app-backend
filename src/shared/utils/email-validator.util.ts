import { BadRequestException } from '@nestjs/common';
import { promises as dns } from 'dns';

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.fr': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.bj': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.cmo': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'icloud.co': 'icloud.com',
};

const DISPOSABLE_OR_FAKE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.local',
  'localhost',
  'invalid',
  'yopmail.com',
  'yopmail.fr',
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'trashmail.com',
  'sharklasers.com',
]);

async function hasValidMailRecords(domain: string): Promise<boolean> {
  const timeoutPromise = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(true), 3000),
  );

  const checkPromise = (async () => {
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (Array.isArray(mxRecords) && mxRecords.length > 0) {
        return mxRecords.some((r) => Boolean(r.exchange && r.exchange.trim() && r.exchange !== '.'));
      }
    } catch (err: any) {
      if (err?.code === 'ENOTFOUND' || err?.code === 'EREFUSED') {
        return false;
      }
      if (err?.code !== 'ENODATA') {
        // Network/DNS transient error: do not block legitimate users offline
        return true;
      }
    }

    try {
      const aRecords = await dns.resolve4(domain);
      return Array.isArray(aRecords) && aRecords.length > 0;
    } catch (err: any) {
      if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') {
        return false;
      }
      return true;
    }
  })();

  return Promise.race([checkPromise, timeoutPromise]);
}

/**
 * Vérifie qu'une adresse e-mail est syntaxiquement valide, sans faute de frappe
 * évidente sur le domaine, non jetable, et que son domaine possède un serveur mail (MX/A).
 */
export async function assertDeliverableEmail(rawEmail: string): Promise<string> {
  const email = (rawEmail ?? '').toLowerCase().trim();

  if (!email) {
    throw new BadRequestException("L'adresse e-mail est obligatoire.");
  }

  if (!STRICT_EMAIL_REGEX.test(email)) {
    throw new BadRequestException(
      `L'adresse e-mail « ${rawEmail} » n'est pas valide. Exemple attendu : nom@entreprise.com.`,
    );
  }

  const [localPart, domain] = email.split('@');

  if (!localPart || !domain || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    throw new BadRequestException(
      `Le format de l'adresse e-mail « ${email} » est incorrect.`,
    );
  }

  const tld = domain.split('.').pop() ?? '';
  if (tld.length < 2) {
    throw new BadRequestException(
      `L'extension du domaine de l'adresse « ${email} » est invalide.`,
    );
  }

  if (COMMON_DOMAIN_TYPOS[domain]) {
    const suggested = `${localPart}@${COMMON_DOMAIN_TYPOS[domain]}`;
    throw new BadRequestException(
      `Le domaine « @${domain} » semble contenir une faute de frappe. Vouliez-vous écrire « ${suggested} » ?`,
    );
  }

  const isTestEnv = process.env.NODE_ENV === 'test';

  if (!isTestEnv && DISPOSABLE_OR_FAKE_DOMAINS.has(domain)) {
    throw new BadRequestException(
      `Les adresses e-mail de test ou temporaires (« @${domain} ») ne sont pas acceptées. Veuillez renseigner une adresse e-mail réelle et active.`,
    );
  }

  const domainDeliverable = isTestEnv ? true : await hasValidMailRecords(domain);
  if (!domainDeliverable) {
    throw new BadRequestException(
      `Le domaine « @${domain} » de l'adresse « ${email} » est introuvable ou ne peut pas recevoir d'e-mails. Veuillez vérifier l'adresse saisie.`,
    );
  }

  return email;
}
