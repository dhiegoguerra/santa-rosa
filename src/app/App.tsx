import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Scale, Users, FileText, Clock, Shield, Briefcase, ChevronRight, Mail, Phone, MapPin } from 'lucide-react';
import logoImage from '../imports/image.png';

const initialContactForm = {
  nome: '',
  email: '',
  telefone: '',
  assunto: '',
  mensagem: '',
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (!digits) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function App() {
  const [hoveredArea, setHoveredArea] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState(initialContactForm);
  const [contactFeedback, setContactFeedback] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const apiBaseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : '';

  const expertiseAreas = [
    {
      icon: FileText,
      title: 'Rescisão Contratual',
      description: 'Análise e defesa em casos de demissão sem justa causa, rescisão indireta e cumprimento de verbas rescisórias.',
    },
    {
      icon: Clock,
      title: 'Horas Extras e Adicionais',
      description: 'Cálculo e cobrança de horas extras, adicional noturno, insalubridade e periculosidade não pagos.',
    },
    {
      icon: Shield,
      title: 'Acidente de Trabalho',
      description: 'Representação em casos de acidente de trabalho, doença ocupacional e indenização por danos morais e materiais.',
    },
    {
      icon: Scale,
      title: 'Assédio Moral e Sexual',
      description: 'Proteção jurídica contra assédio no ambiente de trabalho, com busca de reparação integral.',
    },
    {
      icon: Users,
      title: 'Direitos Coletivos',
      description: 'Assessoria em acordos coletivos, convenções e representação sindical.',
    },
    {
      icon: Briefcase,
      title: 'Consultoria Preventiva',
      description: 'Orientação para empresas e trabalhadores na prevenção de conflitos trabalhistas.',
    },
  ];

  function handleContactChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { id, value } = event.target;
    const nextValue = id === 'telefone' ? formatPhone(value) : value;

    setContactForm((current) => ({
      ...current,
      [id]: nextValue,
    }));

    if (contactFeedback.type !== 'idle') {
      setContactFeedback({ type: 'idle', message: '' });
    }
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      nome: contactForm.nome.trim(),
      email: contactForm.email.trim(),
      telefone: formatPhone(contactForm.telefone.trim()),
      assunto: contactForm.assunto.trim(),
      descricao: contactForm.mensagem.trim(),
    };

    const phoneDigits = payload.telefone.replace(/\D/g, '');

    if (!payload.nome || !payload.email || !payload.telefone || !payload.assunto || !payload.descricao) {
      setContactFeedback({
        type: 'error',
        message: 'Preencha nome, email, telefone, assunto e mensagem.',
      });
      return;
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setContactFeedback({
        type: 'error',
        message: 'Informe um telefone com 10 ou 11 digitos.',
      });
      return;
    }

    setIsSubmittingContact(true);
    setContactFeedback({ type: 'idle', message: '' });

    try {
      const response = await fetch(`${apiBaseUrl}/cadastrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseData: { sucesso?: boolean; erro?: string; mensagem?: string } | null = null;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = null;
      }

      if (!response.ok || !responseData?.sucesso) {
        throw new Error(responseData?.erro || responseData?.mensagem || 'Nao foi possivel enviar a mensagem.');
      }

      setContactForm(initialContactForm);
      setContactFeedback({
        type: 'success',
        message: 'Mensagem enviada com sucesso. Em breve entraremos em contato.',
      });
    } catch (error) {
      setContactFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem.',
      });
    } finally {
      setIsSubmittingContact(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header/Navigation */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 w-full bg-[#FAF8F5]/95 backdrop-blur-sm z-50 border-b border-[#6B1B1B]/10"
      >
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Santa Rosa Logo" className="h-28 md:h-32 lg:h-36 w-auto" />
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#sobre" className="text-[#2C2416] hover:text-[#6B1B1B] transition-colors">Sobre</a>
            <a href="#atuacao" className="text-[#2C2416] hover:text-[#6B1B1B] transition-colors">Áreas de Atuação</a>
            <a href="#contato" className="text-[#2C2416] hover:text-[#6B1B1B] transition-colors">Contato</a>
          </nav>
          <a
            href="/cadastro_cliente.html"
            className="bg-[#6B1B1B] text-white px-6 py-3 hover:bg-[#541515] transition-all duration-300 flex items-center gap-2 group"
          >
            Consulta Gratuita
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C65D3B' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex flex-col items-start bg-[#6B1B1B]/10 text-[#6B1B1B] px-4 py-3 mb-6 mt-10 md:mt-12 tracking-wider uppercase text-sm gap-2">
              <span>OAB/PA 24.589</span>
              <span>OAB/SP 431.715</span>
            </div>
            <h1
              className="mb-6 text-[#1A1410] leading-[1.1]"
              style={{ fontFamily: "'Crimson Pro', serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 700 }}
            >
              Defendendo seus direitos trabalhistas com excelência
            </h1>
            <p className="text-xl text-[#594A3A] leading-relaxed mb-10">
              Mais de 15 anos de experiência em litígios trabalhistas, recuperação de verbas e proteção de direitos.
              Advocacia comprometida, estratégica e humanizada.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/cadastro_cliente.html"
                className="bg-[#6B1B1B] text-white px-8 py-4 hover:bg-[#541515] transition-all duration-300 flex items-center gap-2 group text-lg"
              >
                Agende uma Consulta
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#sobre"
                className="border-2 border-[#6B1B1B] text-[#6B1B1B] px-8 py-4 hover:bg-[#6B1B1B] hover:text-white transition-all duration-300 text-lg"
              >
                Conheça o Escritório
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="aspect-[4/5] bg-gradient-to-br from-[#6B1B1B] to-[#8B2929] relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Scale className="w-64 h-64 text-white/10" strokeWidth={0.5} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-8 text-white">
                <div className="text-sm uppercase tracking-widest mb-2 opacity-80">Compromisso</div>
                <div className="text-2xl" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 600 }}>
                  Justiça e resultados concretos para cada cliente
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 bg-[#2C2416] text-white p-8 max-w-xs shadow-2xl">
              <div className="text-5xl mb-2" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 700 }}>98%</div>
              <div className="text-sm opacity-90">Taxa de sucesso em causas trabalhistas</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Sobre Section */}
      <section id="sobre" className="scroll-mt-36 md:scroll-mt-44 py-24 px-6 bg-[#2C2416] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-5">
          <Scale className="w-full h-full" strokeWidth={0.5} />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block bg-[#6B1B1B] px-4 py-2 mb-6 tracking-wider uppercase text-sm">
              Sobre Nós
            </div>
            <h2
              className="mb-12 max-w-3xl"
              style={{ fontFamily: "'Crimson Pro', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, lineHeight: 1.2 }}
            >
              Experiência sólida e dedicação total aos seus direitos
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6 text-lg leading-relaxed text-white/90"
            >
              <p>
                Fundado em 2008, o escritório Santa Rosa especializou-se em Direito do Trabalho,
                tornando-se referência na defesa de trabalhadores e empresas com sócios formados pelas melhores instituições do país.
              </p>
              <p>
                Com mais de 15 anos de atuação, já conduzimos centenas de processos trabalhistas, desde ações individuais até
                litígios complexos envolvendo múltiplos colaboradores. Nosso diferencial está na combinação entre conhecimento
                técnico profundo e atendimento humanizado.
              </p>
              <p>
                Nossos advogados são membros ativos da Ordem dos Advogados do Brasil e participantes regulares de congressos e atualizações na área
                trabalhista, mantendo-se sempre atualizados com as mudanças legislativas e jurisprudenciais.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-6"
            >
              <div className="bg-white/5 p-6 border-l-4 border-[#6B1B1B]">
                <div className="text-3xl mb-2" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 700 }}>15+</div>
                <div className="text-white/70">Anos de Experiência</div>
              </div>
              <div className="bg-white/5 p-6 border-l-4 border-[#6B1B1B]">
                <div className="text-3xl mb-2" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 700 }}>500+</div>
                <div className="text-white/70">Causas Trabalhistas Conduzidas</div>
              </div>
              <div className="bg-white/5 p-6 border-l-4 border-[#6B1B1B]">
                <div className="text-3xl mb-2" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 700 }}>R$ 12M+</div>
                <div className="text-white/70">Recuperados para Clientes</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Áreas de Atuação */}
      <section id="atuacao" className="scroll-mt-36 md:scroll-mt-44 py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-block bg-[#6B1B1B]/10 text-[#6B1B1B] px-4 py-2 mb-6 tracking-wider uppercase text-sm">
              Expertise Completa
            </div>
            <h2
              className="mb-6 text-[#1A1410]"
              style={{ fontFamily: "'Crimson Pro', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700 }}
            >
              Áreas de Atuação
            </h2>
            <p className="text-xl text-[#594A3A] max-w-3xl mx-auto">
              Atendimento especializado em todas as vertentes do direito trabalhista, com foco em resultados efetivos.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {expertiseAreas.map((area, index) => {
              const Icon = area.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  onMouseEnter={() => setHoveredArea(index)}
                  onMouseLeave={() => setHoveredArea(null)}
                  className={`p-8 border-2 transition-all duration-500 cursor-pointer relative overflow-hidden ${
                    hoveredArea === index
                      ? 'border-[#6B1B1B] bg-[#6B1B1B] text-white shadow-xl -translate-y-2'
                      : 'border-[#E8DED0] bg-[#FAF8F5] text-[#2C2416] hover:border-[#6B1B1B]/30'
                  }`}
                >
                  <div className="absolute top-0 right-0 opacity-5">
                    <Icon className="w-32 h-32" strokeWidth={0.5} />
                  </div>
                  <div className="relative z-10">
                    <Icon
                      className={`w-12 h-12 mb-6 transition-colors ${hoveredArea === index ? 'text-white' : 'text-[#6B1B1B]'}`}
                      strokeWidth={1.5}
                    />
                    <h3
                      className="mb-4"
                      style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.5rem', fontWeight: 600 }}
                    >
                      {area.title}
                    </h3>
                    <p className={`leading-relaxed ${hoveredArea === index ? 'text-white/90' : 'text-[#594A3A]'}`}>
                      {area.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#6B1B1B] to-[#8B2929] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-black rounded-full blur-3xl"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <h2
            className="mb-6"
            style={{ fontFamily: "'Crimson Pro', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700 }}
          >
            Seus direitos trabalhistas merecem a melhor defesa
          </h2>
          <p className="text-xl mb-10 text-white/90 leading-relaxed">
            Não deixe para depois. Entre em contato agora e receba uma análise inicial gratuita do seu caso.
            Estamos prontos para lutar pelos seus direitos.
          </p>
          <a
            href="#contato"
            className="inline-flex items-center gap-3 bg-white text-[#6B1B1B] px-10 py-5 hover:bg-[#FAF8F5] transition-all duration-300 group text-lg shadow-2xl"
          >
            Fale com Nossa Equipe Agora
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </section>

      {/* Contato Section */}
      <section id="contato" className="scroll-mt-36 md:scroll-mt-44 py-24 px-6 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block bg-[#6B1B1B]/10 text-[#6B1B1B] px-4 py-2 mb-6 tracking-wider uppercase text-sm">
              Entre em Contato
            </div>
            <h2
              className="mb-6 text-[#1A1410]"
              style={{ fontFamily: "'Crimson Pro', serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700 }}
            >
              Fale com nossos especialistas
            </h2>
            <p className="text-lg text-[#594A3A] mb-10 leading-relaxed">
              Preencha o formulário ou utilize os canais de contato abaixo. Nossa equipe responderá em até 24 horas.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-[#6B1B1B] p-3 text-white">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-[#2C2416] mb-1">Telefone</div>
                  <div className="text-[#594A3A]">(11) 98765-4321</div>
                  <div className="text-[#594A3A]">(11) 3456-7890</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#6B1B1B] p-3 text-white">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-[#2C2416] mb-1">E-mail</div>
                  <div className="text-[#594A3A]">contato@santarosa.adv.br</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#6B1B1B] p-3 text-white">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-[#2C2416] mb-1">Endereço</div>
                  <div className="text-[#594A3A]">Avenida Paulista, 1578 - 12º andar</div>
                  <div className="text-[#594A3A]">Bela Vista, São Paulo - SP</div>
                  <div className="text-[#594A3A]">CEP 01310-200</div>
                </div>
              </div>
            </div>

            <div className="mt-10 p-6 bg-[#6B1B1B]/5 border-l-4 border-[#6B1B1B]">
              <div className="font-semibold text-[#2C2416] mb-2">Horário de Atendimento</div>
              <div className="text-[#594A3A]">Segunda a Sexta: 9h às 18h</div>
              <div className="text-[#594A3A]">Sábados: 9h às 13h (com agendamento)</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white p-10 border border-[#E8DED0] shadow-xl"
          >
            <form className="space-y-6" onSubmit={handleContactSubmit}>
              <div>
                <label htmlFor="nome" className="block text-[#2C2416] mb-2">Nome Completo</label>
                <input
                  type="text"
                  id="nome"
                  value={contactForm.nome}
                  onChange={handleContactChange}
                  required
                  className="w-full px-4 py-3 border-2 border-[#E8DED0] focus:border-[#6B1B1B] outline-none transition-colors bg-[#FAF8F5]"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-[#2C2416] mb-2">E-mail</label>
                <input
                  type="email"
                  id="email"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  required
                  className="w-full px-4 py-3 border-2 border-[#E8DED0] focus:border-[#6B1B1B] outline-none transition-colors bg-[#FAF8F5]"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label htmlFor="telefone" className="block text-[#2C2416] mb-2">Telefone</label>
                <input
                  type="tel"
                  id="telefone"
                  value={contactForm.telefone}
                  onChange={handleContactChange}
                  required
                  inputMode="numeric"
                  maxLength={15}
                  className="w-full px-4 py-3 border-2 border-[#E8DED0] focus:border-[#6B1B1B] outline-none transition-colors bg-[#FAF8F5]"
                  placeholder="(11) 98765-4321"
                />
              </div>

              <div>
                <label htmlFor="assunto" className="block text-[#2C2416] mb-2">Assunto</label>
                <select
                  id="assunto"
                  value={contactForm.assunto}
                  onChange={handleContactChange}
                  required
                  className="w-full px-4 py-3 border-2 border-[#E8DED0] focus:border-[#6B1B1B] outline-none transition-colors bg-[#FAF8F5]"
                >
                  <option value="">Selecione o tipo de caso</option>
                  <option>Rescisão Contratual</option>
                  <option value="Horas Extras">Horas Extras</option>
                  <option value="Acidente de Trabalho">Acidente de Trabalho</option>
                  <option>Assédio</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label htmlFor="mensagem" className="block text-[#2C2416] mb-2">Mensagem</label>
                <textarea
                  id="mensagem"
                  rows={5}
                  value={contactForm.mensagem}
                  onChange={handleContactChange}
                  required
                  className="w-full px-4 py-3 border-2 border-[#E8DED0] focus:border-[#6B1B1B] outline-none transition-colors bg-[#FAF8F5] resize-none"
                  placeholder="Descreva brevemente sua situação..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmittingContact}
                className="w-full bg-[#6B1B1B] text-white px-8 py-4 hover:bg-[#541515] disabled:bg-[#8E5E5E] disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group text-lg"
              >
                {isSubmittingContact ? 'Enviando...' : 'Enviar Mensagem'}
                <ChevronRight className={`w-5 h-5 transition-transform ${isSubmittingContact ? 'opacity-40' : 'group-hover:translate-x-1'}`} />
              </button>
              <p
                className={`min-h-6 text-sm ${
                  contactFeedback.type === 'success'
                    ? 'text-[#2E7D32]'
                    : contactFeedback.type === 'error'
                      ? 'text-[#B3261E]'
                      : 'text-transparent'
                }`}
              >
                {contactFeedback.message || ' '}
              </p>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1410] text-white/70 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logoImage} alt="Santa Rosa Logo" className="h-16 md:h-20 w-auto" />
              </div>
              <p className="text-sm leading-relaxed">
                Escritório de advocacia comprometido com a defesa dos seus direitos e a busca por justiça em cada causa.
              </p>
            </div>

            <div>
              <div className="font-semibold text-white mb-4">Links Rápidos</div>
              <div className="space-y-2">
                <a href="#sobre" className="block hover:text-[#6B1B1B] transition-colors">Sobre</a>
                <a href="#atuacao" className="block hover:text-[#6B1B1B] transition-colors">Áreas de Atuação</a>
                <a href="#contato" className="block hover:text-[#6B1B1B] transition-colors">Contato</a>
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-4">Informações Legais</div>
              <div className="text-sm space-y-1">
                <div>OAB/PA 24.589</div>
                <div>OAB/SP 431.715</div>
               {/** <div>CNPJ: 12.345.678/0001-90</div>*/}
                <div className="pt-2">
                  <a href="#" className="hover:text-[#6B1B1B] transition-colors">Política de Privacidade</a>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center text-sm">
            <p>&copy; 2026 Santa Rosa - Advocacia e Consultoria Jurídica. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
