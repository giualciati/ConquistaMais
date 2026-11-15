import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Gift } from 'lucide-react';
import { Modal } from './ui';

/* Aguardando o GPS no check-in */
export function GpsModal({ open, onCancel }) {
  if (!open) return null;
  return (
    <Modal onClose={onCancel}>
      <div className="modal-icon soft-blue"><Loader2 size={34} className="spin" color="var(--blue)" /></div>
      <h3 className="modal-title">Verificando GPS...</h3>
      <p className="modal-text">Calculando sua distância até o campus Senac</p>
      <button className="btn ghost full" style={{ marginTop: 22 }} onClick={onCancel}>Cancelar</button>
    </Modal>
  );
}

/* Voucher com QR code real; a equipe confere o código no balcão */
export function VoucherModal({ voucher, onClose }) {
  const [img, setImg] = useState('');
  useEffect(() => {
    setImg('');
    if (voucher) QRCode.toDataURL(`conquista-voucher:${voucher.codigo}`, { margin: 1, width: 220 }).then(setImg);
  }, [voucher]);

  if (!voucher) return null;
  return (
    <Modal onClose={onClose}>
      <div className="modal-icon soft-orange"><Gift size={30} color="var(--orange)" /></div>
      <h3 className="modal-title">{voucher.usado ? 'Voucher já utilizado' : 'Seu voucher'}</h3>
      <p className="modal-text">{voucher.titulo}</p>
      <div style={{ margin: '18px 0', opacity: voucher.usado ? 0.35 : 1 }}>
        {img ? <img src={img} alt="QR Code do voucher" className="qr" width={200} height={200} /> : <div className="qr" style={{ width: 200, height: 200 }} />}
      </div>
      <div className="code-box">{voucher.codigo}</div>
      <p className="modal-text small">Apresente este código no balcão do Senac</p>
      <button className="btn primary full" style={{ marginTop: 18 }} onClick={onClose}>Fechar</button>
    </Modal>
  );
}
