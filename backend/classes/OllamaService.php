<?php
class OllamaService {
    private string $url = "http://127.0.0.1:11434/api/chat";
    private string $model = "llama3.2:3b";

    public function chat(string $systemPrompt, string $message): string {
        $payload = [
            "model" => $this->model,
            "stream" => false,
            "messages" => [
                ["role" => "system", "content" => $systemPrompt],
                ["role" => "user", "content" => $message]
            ]
        ];

        $ch = curl_init($this->url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 90
        ]);

        $result = curl_exec($ch);
        $error = curl_error($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($result === false) {
            throw new RuntimeException("Ollama connection failed: " . $error);
        }

        if ($status !== 200) {
            throw new RuntimeException("Ollama returned HTTP " . $status);
        }

        $data = json_decode($result, true);
        $answer = $data["message"]["content"] ?? null;

        if (!is_string($answer)) {
            throw new RuntimeException("Invalid Ollama response");
        }

        return $answer;
    }
}