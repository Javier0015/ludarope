import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ModuloPendiente({ titulo }) {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-[2rem] border border-[#F5E0E6] bg-white px-6 py-14 text-center shadow-[0_12px_36px_rgba(104,55,71,0.06)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#FFF0F5] text-[#FC4D84]">
        <Construction size={31} />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.17em] text-[#FE714B]">LUDAROPE POS</p>
      <h1 className="text-2xl font-black tracking-tight text-[#342A2E] sm:text-3xl">{titulo}</h1>
      <p className="max-w-lg text-sm leading-relaxed text-[#8E7A83]">
        Este módulo todavía no se ha desarrollado. Lo construiremos paso a paso para el nuevo sistema de prendas únicas.
      </p>
      <button
        type="button"
        onClick={() => navigate(usuario?.rol === 'CAJERO' ? '/app/pos' : '/app/dashboard')}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E23A70]"
      >
        <ArrowLeft size={17} /> Volver
      </button>
    </section>
  );
}
