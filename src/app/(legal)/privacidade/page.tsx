export const metadata = { title: "Política de Privacidade" };
export default function PrivacyPolicy() {
  return (
    <article className="space-y-5">
      <h1 className="text-3xl font-bold text-primary">
        Política de Privacidade
      </h1>
      <p>
        O SABENÇA é um MVP acadêmico para descoberta de colegas, portfólios e
        trocas na comunidade universitária FATECE. O acesso depende de
        autorização institucional e confirmação do e-mail cadastrado.
      </p>
      <h2 className="text-xl font-bold">Dados utilizados</h2>
      <p>
        A instituição cadastra nome, RA, e-mail, telefone, nascimento, curso e
        semestre para validar o vínculo e permitir primeiro acesso e
        recuperação. CPF é utilizado para conferir duplicidade por fingerprint
        HMAC; o número não integra o perfil social. Esses dados institucionais
        não são exibidos a outros estudantes.
      </p>
      <p>
        Nome, curso e instituição identificam o estudante na comunidade.
        Biografia, habilidades, interesses, projetos e anúncios são opcionais. A
        seção Privacidade do perfil permite controlar sua visibilidade. Senhas
        são gerenciadas pelo Supabase Auth; chaves privadas não são
        disponibilizadas ao navegador.
      </p>
      <h2 className="text-xl font-bold">Documentos e moderação</h2>
      <p>
        Certificados originais ficam em bucket privado, acessíveis ao titular e
        à administração por links temporários. Somente metadados de certificados
        analisados e verificados aparecem a outros membros. Denúncias são
        acessíveis ao denunciante e à administração. Bloqueios restringem a
        descoberta bilateral e removem conexões existentes.
      </p>
      <h2 className="text-xl font-bold">Infraestrutura e conservação</h2>
      <p>
        A aplicação utiliza Vercel e Supabase para hospedagem, autenticação,
        banco e arquivos. Cookies de sessão mantêm o login; registros de
        tentativas e de administração apoiam a segurança. O projeto não utiliza
        publicidade direcionada. Os dados permanecem enquanto necessários ao
        funcionamento e à validação acadêmica; retenção institucional e descarte
        de backups precisam ser definidos antes de uso definitivo.
      </p>
      <h2 className="text-xl font-bold">Solicitações e contato</h2>
      <p>
        Você pode editar e excluir o conteúdo opcional pelas telas disponíveis.
        Para informações institucionais, acesso, correção, exclusão ou outros
        pedidos sobre seus dados, procure a secretaria/administração responsável
        pelo SABENÇA. O atendimento deve confirmar a identidade e considerar os
        registros necessários à segurança.
      </p>
      <p className="rounded-xl bg-secondary p-4">
        [PENDENTE INSTITUCIONAL: informar canal oficial de contato e responsável
        pelo tratamento de solicitações.]
      </p>
    </article>
  );
}
