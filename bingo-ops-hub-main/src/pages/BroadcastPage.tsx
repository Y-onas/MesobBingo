import { useState } from 'react';
import { Send, Users, DollarSign, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { sendBroadcast } from '../lib/api';

export default function BroadcastPage() {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'depositors'>('all');
  const [buttonType, setButtonType] = useState<'none' | 'play' | 'deposit' | 'balance' | 'invite'>('none');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const handleSend = async () => {
    if (imageError) {
      alert('Please fix the image URL before sending');
      return;
    }

    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    if (!confirm(`Send broadcast to ${audience === 'all' ? 'ALL USERS' : 'DEPOSITORS ONLY'}?`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await sendBroadcast({
        message,
        audience,
        buttonType: buttonType === 'none' ? undefined : buttonType,
        imageUrl: imageUrl || undefined,
      });
      setResult(res);
      setMessage('');
      setImageUrl('');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Broadcast Message</h1>
        <p className="text-gray-600 mt-1">Send messages with images and interactive buttons to users</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Audience Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Audience
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAudience('all')}
              className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition ${
                audience === 'all'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">All Users</span>
            </button>
            <button
              onClick={() => setAudience('depositors')}
              className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition ${
                audience === 'depositors'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              <span className="font-medium">Depositors Only</span>
            </button>
          </div>
        </div>

        {/* Image URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image URL (Optional)
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageError(false); // Reset error when URL changes
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {imageUrl && (
                <button
                  onClick={() => {
                    setImageUrl('');
                    setImageError(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {imageUrl && (
            <div className="mt-2 p-2 border border-gray-200 rounded-lg">
              {imageError ? (
                <p className="text-red-500 text-sm">Invalid image URL</p>
              ) : (
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="max-h-40 rounded"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          )}
          <p className="text-sm text-gray-500 mt-1">
            <ImageIcon className="w-4 h-4 inline mr-1" />
            Paste a direct image URL (jpg, png, gif)
          </p>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message {imageUrl && '(Caption)'}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your broadcast message here...&#10;&#10;You can use:&#10;- Emojis 🎉&#10;- Multiple lines&#10;- Markdown formatting"
            className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            maxLength={imageUrl ? 1024 : 4096}
          />
          <p className={`text-sm mt-1 ${message.length > (imageUrl ? 900 : 3800) ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
            {message.length} / {imageUrl ? '1024' : '4096'} characters
            {imageUrl && message.length > 900 && ' (caption limit)'}
          </p>
        </div>

        {/* Button Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Interactive Button (Optional)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <button
              onClick={() => setButtonType('none')}
              className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                buttonType === 'none'
                  ? 'border-gray-500 bg-gray-50 text-gray-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              No Button
            </button>
            <button
              onClick={() => setButtonType('play')}
              className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                buttonType === 'play'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              🎮 Play
            </button>
            <button
              onClick={() => setButtonType('deposit')}
              className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                buttonType === 'deposit'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              💰 Deposit
            </button>
            <button
              onClick={() => setButtonType('balance')}
              className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                buttonType === 'balance'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              💳 Balance
            </button>
            <button
              onClick={() => setButtonType('invite')}
              className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                buttonType === 'invite'
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              🎁 Invite
            </button>
          </div>
        </div>

        {/* Send Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {audience === 'all' ? 'Broadcasting to all users' : 'Broadcasting to depositors only'}
            {buttonType !== 'none' && ` with ${buttonType} button`}
          </div>
          <button
            onClick={handleSend}
            disabled={loading || !message.trim() || imageError}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Broadcast
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && (() => {
          const allSuccess = result.failed === 0;
          const allFailed = result.success === 0 && result.failed > 0;
          const mixed = result.success > 0 && result.failed > 0;
          
          const bgColor = allSuccess ? 'bg-green-50' : allFailed ? 'bg-red-50' : 'bg-yellow-50';
          const borderColor = allSuccess ? 'border-green-200' : allFailed ? 'border-red-200' : 'border-yellow-200';
          const titleColor = allSuccess ? 'text-green-900' : allFailed ? 'text-red-900' : 'text-yellow-900';
          const title = allSuccess ? 'Broadcast Complete!' : allFailed ? 'Broadcast Failed' : 'Broadcast Partially Complete';
          
          return (
            <div className={`mt-6 p-4 ${bgColor} border ${borderColor} rounded-lg`}>
              <h3 className={`font-semibold ${titleColor} mb-2`}>{title}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">✅ Sent Successfully:</span>
                  <span className="font-bold text-green-900 ml-2">{result.success}</span>
                </div>
                <div>
                  <span className="text-red-700">❌ Failed:</span>
                  <span className="font-bold text-red-900 ml-2">{result.failed}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Keep messages concise and engaging</li>
          <li>• Use emojis to make messages more eye-catching</li>
          <li>• Add interactive buttons to increase user engagement</li>
          <li>• Test with "Depositors Only" before broadcasting to all users</li>
          <li>• Messages are sent with 50ms delay to avoid rate limits</li>
        </ul>
      </div>
    </div>
  );
}
