export const metadata = { title: "Regras da Comunidade" };
export default function CommunityRules() {
  return (
    <article className="space-y-5">
      <h1 className="text-3xl font-bold text-primary">Regras da Comunidade</h1>
      <p>
        Use o SABENÇA para aprender, colaborar e encontrar pessoas e ofertas
        relacionadas à vida universitária.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          Respeite os colegas. Assédio, discriminação, ameaças e exposição de
          dados pessoais não são aceitáveis.
        </li>
        <li>
          Informe corretamente suas habilidades, projetos, produtos e serviços.
          Não falsifique certificados nem identidade acadêmica.
        </li>
        <li>
          Publique conteúdo autorizado. Não envie documentos de terceiros nem
          inclua dados pessoais desnecessários em certificados.
        </li>
        <li>
          Use títulos, preços, condições e status claros nos anúncios. Marque
          ofertas vendidas ou indisponíveis e evite spam e fraude.
        </li>
        <li>
          Respeite recusas de conexão e bloqueios. Não tente contornar
          restrições com outras contas.
        </li>
        <li>
          Denuncie perfis ou anúncios pela opção disponível. Não utilize
          denúncias para perseguir pessoas.
        </li>
      </ul>
      <h2 className="text-xl font-bold">Análise e providências</h2>
      <p>
        A administração analisa denúncias e documentos, pode dispensar relatos
        improcedentes e adotar as providências institucionais necessárias.
        Bloquear um usuário oculta o contato entre ambos e remove conexões;
        desbloquear não as restaura automaticamente.
      </p>
      <p>
        [PENDENTE INSTITUCIONAL: informar canal oficial para suporte e
        contestação de decisões.]
      </p>
    </article>
  );
}
