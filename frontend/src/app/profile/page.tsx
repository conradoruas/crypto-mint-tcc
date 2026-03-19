"use client";
import { useConnection } from "wagmi";
import { Navbar } from "@/components/NavBar";

export default function ProfilePage() {
  const { address, isConnected } = useConnection();

  if (!isConnected)
    return (
      <div className="text-center py-20">
        Conecte sua carteira para ver seu perfil.
      </div>
    );

  return (
    <main>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 mb-10">
          <p className="text-slate-400 text-sm mb-2">Carteira Conectada</p>
          <h2 className="text-xl font-mono font-bold break-all">{address}</h2>
        </div>
        {/* Aqui entrará a lógica de listar apenas os NFTs do endereço logado */}
      </div>
    </main>
  );
}
