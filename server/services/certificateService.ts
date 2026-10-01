export interface CertificateIssuer {
  issueCertificate(applicationId: string): Promise<string>;
}

export class NoOpCertificateIssuer implements CertificateIssuer {
  async issueCertificate(_applicationId: string): Promise<string> {
    // To be implemented in Block 7
    return 'CERT-NOOP';
  }
}
