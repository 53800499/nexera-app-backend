import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

type MessageTree = Record<string, string | Record<string, unknown>>;

@Injectable()
export class I18nService {
  private readonly catalogs = new Map<string, MessageTree>();
  private readonly defaultLocale = 'fr';
  private readonly supportedLocales = ['fr', 'en'];

  constructor() {
    this.loadLocale('fr');
    this.loadLocale('en');
  }

  t(key: string, locale?: string, params?: Record<string, string | number>) {
    const lang = this.resolveLocale(locale);
    const catalog = this.catalogs.get(lang) ?? this.catalogs.get('fr')!;
    const message = this.resolveKey(catalog, key) ?? key;

    if (!params) return message;
    return Object.entries(params).reduce(
      (text, [param, value]) =>
        text.replace(new RegExp(`{{${param}}}`, 'g'), String(value)),
      message,
    );
  }

  resolveLocale(acceptLanguage?: string): string {
    if (!acceptLanguage) return this.defaultLocale;
    const preferred = acceptLanguage
      .split(',')
      .map((part) => part.trim().split(';')[0].toLowerCase())
      .find((code) =>
        this.supportedLocales.some((l) => code === l || code.startsWith(`${l}-`)),
      );

    if (!preferred) return this.defaultLocale;
    return preferred.startsWith('en') ? 'en' : 'fr';
  }

  private loadLocale(locale: string) {
    const filePath = path.join(
      process.cwd(),
      'src',
      'i18n',
      locale,
      'messages.json',
    );
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      this.catalogs.set(locale, JSON.parse(raw) as MessageTree);
    } catch {
      this.catalogs.set(locale, {});
    }
  }

  private resolveKey(tree: MessageTree, key: string): string | undefined {
    const parts = key.split('.');
    let current: string | Record<string, unknown> | undefined = tree;
    for (const part of parts) {
      if (!current || typeof current === 'string') return undefined;
      current = current[part] as string | Record<string, unknown> | undefined;
    }
    return typeof current === 'string' ? current : undefined;
  }
}
