<?php

class OllamaService {
    private string $url;
    private string $model;

    public function __construct() {
        require_once __DIR__ . '/../config/env.php';
        $this->url = requiredEnv('OLLAMA_URL');
        $this->model = requiredEnv('OLLAMA_MODEL');
        if (!filter_var($this->url, FILTER_VALIDATE_URL) || !in_array(parse_url($this->url, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new RuntimeException('AI service configuration is invalid.');
        }
    }
    public function chat(string $systemPrompt, string $message, array $history = [], ?callable $onToken = null): string {
        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        foreach ($history as $previousMessage) {
            $messages[] = $previousMessage;
        }
        $messages[] = ['role' => 'user', 'content' => $message];
        $stream = $onToken !== null;
        $payload = [
            'model' => $this->model,
            'stream' => $stream,
            'messages' => $messages,
            'options' => ['temperature' => 0.1, 'num_predict' => 600, 'num_ctx' => 16384],
            'keep_alive' => '5m'
        ];
        $connection = curl_init($this->url);
        curl_setopt_array($connection, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 90
        ]);
        $answer = '';
        $buffer = '';
        $streamError = null;
        if ($stream) {
             
            curl_setopt($connection, CURLOPT_WRITEFUNCTION, function ($handle, string $chunk) use (&$buffer, &$answer, &$streamError, $onToken): int {
                $buffer .= $chunk;
                while (($position = strpos($buffer, "\n")) !== false) {
                    $line = substr($buffer, 0, $position);
                    $buffer = substr($buffer, $position + 1);
                    $row = json_decode($line, true);
                    if (isset($row['error'])) $streamError = (string) $row['error'];
                    $text = $row['message']['content'] ?? '';
                    if (is_string($text) && $text !== '') {
                        $answer .= $text;
                        $onToken($text);
                    }
                }
                if (connection_aborted()) return 0;
                return strlen($chunk);
            });
        } else {
            curl_setopt($connection, CURLOPT_RETURNTRANSFER, true);
        }

        try {
            $result = curl_exec($connection);
            if ($result === false) throw new RuntimeException('Ollama request failed: ' . curl_error($connection));
            if (curl_getinfo($connection, CURLINFO_HTTP_CODE) !== 200) throw new RuntimeException('Ollama returned an unsuccessful response.');
            if ($streamError !== null) throw new RuntimeException($streamError);
            if (!$stream) {
                $data = json_decode($result, true, 512, JSON_THROW_ON_ERROR);
                $answer = $data['message']['content'] ?? '';
            } elseif (trim($buffer) !== '') {
                $data = json_decode($buffer, true);
                $lastText = $data['message']['content'] ?? '';
                if (is_string($lastText) && $lastText !== '') {
                    $answer .= $lastText;
                    $onToken($lastText);
                }
            }
            if (!is_string($answer) || trim($answer) === '') throw new RuntimeException('Ollama returned an empty answer.');
            return trim($answer);
        } finally {
            curl_close($connection);
        }
    }
}
